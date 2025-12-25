import json
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


_LOCK = threading.Lock()


def _get_store_path() -> Path:
    """
    Return path to JSON file that stores process instances.
    File is located two levels above this module, next to app/.
    """
    base_dir = Path(__file__).resolve().parents[2]
    return base_dir / "process_instances_store.json"


def _ensure_store_file(path: Path) -> None:
    if not path.exists():
        path.write_text("[]", encoding="utf-8")


def _load_instances(path: Path) -> List[Dict[str, Any]]:
    _ensure_store_file(path)
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        backup_path = path.with_suffix(".bak")
        backup_path.write_text(text, encoding="utf-8")
        data = []
    if isinstance(data, list):
        return data
    return []


def _save_instances(path: Path, instances: List[Dict[str, Any]]) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(instances, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _make_key(client_id: str, profile_code: str, period: str) -> str:
    return f"{client_id}::{profile_code}::{period}"


def get_all_instances() -> List[Dict[str, Any]]:
    """
    Return all process instances from the JSON store.
    """
    path = _get_store_path()
    with _LOCK:
        return _load_instances(path)


def find_instance_by_id(instance_id: str) -> Optional[Dict[str, Any]]:
    """
    Find a process instance by its id.
    """
    path = _get_store_path()
    with _LOCK:
        instances = _load_instances(path)
        for inst in instances:
            if inst.get("id") == instance_id:
                return inst
    return None


def find_instance_for_event(
    client_id: str,
    profile_code: str,
    period: str,
) -> Optional[Dict[str, Any]]:
    """
    Find existing process instance for given client/profile/period triple.
    """
    key = _make_key(client_id, profile_code, period)
    path = _get_store_path()
    with _LOCK:
        instances = _load_instances(path)
        for inst in instances:
            if inst.get("key") == key:
                return inst
    return None


def list_instances_for_client(
    client_id: str,
    period: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Return all process instances for given client.

    If period is provided (exact match), only instances with this period are returned.
    """
    path = _get_store_path()
    with _LOCK:
        instances = _load_instances(path)

    client_id_str = str(client_id).strip()

    client_filtered: List[Dict[str, Any]] = [
        inst
        for inst in instances
        if str(inst.get("client_id") or "").strip() == client_id_str
    ]

    if period is None:
        return client_filtered

    period_str = str(period).strip()
    return [
        inst
        for inst in client_filtered
        if str(inst.get("period") or "").strip() == period_str
    ]


def upsert_instance_from_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Find or create a process instance for the given control event.

    Identity of a process instance:
        client_id + profile_code + period

    The function appends the event id to the instance "events" list if it is not there yet.
    """
    client_id = str(event.get("client_id", "")).strip()
    profile_code = str(event.get("profile_code", "")).strip()
    period = str(event.get("period", "")).strip()
    event_id = str(event.get("id", "")).strip()
    event_code = str(event.get("event_code", "")).strip()

    if not client_id or not profile_code or not period:
        raise ValueError("Missing required fields in event: client_id, profile_code or period")

    key = _make_key(client_id, profile_code, period)
    path = _get_store_path()
    now_iso = datetime.utcnow().isoformat() + "Z"

    with _LOCK:
        instances = _load_instances(path)

        instance: Optional[Dict[str, Any]] = None
        for item in instances:
            if item.get("key") == key:
                instance = item
                break

        if instance is None:
            instance = {
                "id": str(uuid.uuid4()),
                "key": key,
                "client_id": client_id,
                "profile_code": profile_code,
                "period": period,
                "status": "open",
                "source": "auto_from_control_event",
                "events": [],
                "last_event_code": None,
                "steps": [],
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            instances.append(instance)

        if event_id and event_id not in instance["events"]:
            instance["events"].append(event_id)

        if event_code:
            instance["last_event_code"] = event_code

        instance["updated_at"] = now_iso

        _save_instances(path, instances)

    return instance


def _save_back_instance(instance: Dict[str, Any]) -> None:
    """
    Persist a single modified instance back to the store.
    """
    path = _get_store_path()
    now = datetime.utcnow().isoformat() + "Z"

    with _LOCK:
        items = _load_instances(path)
        for idx, it in enumerate(items):
            if it.get("id") == instance.get("id"):
                instance["updated_at"] = now
                items[idx] = instance
                break
        _save_instances(path, items)


def add_step(instance_id: str, title: str) -> Dict[str, Any]:
    """
    Add a new pending step to the process instance.
    """
    inst = find_instance_by_id(instance_id)
    if inst is None:
        raise ValueError(f"Process instance not found: {instance_id}")

    if "steps" not in inst or not isinstance(inst["steps"], list):
        inst["steps"] = []

    step = {
        "id": str(uuid.uuid4()),
        "title": title,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "completed_at": None,
    }

    inst["steps"].append(step)
    _save_back_instance(inst)

    return step


def complete_step(instance_id: str, step_id: str) -> Dict[str, Any]:
    """
    Mark selected step as completed and, if all steps are done, set instance.status = "completed".
    """
    inst = find_instance_by_id(instance_id)
    if inst is None:
        raise ValueError(f"Process instance not found: {instance_id}")

    steps = inst.get("steps") or []
    target = None
    for st in steps:
        if st.get("id") == step_id:
            target = st
            break

    if target is None:
        raise ValueError(f"Step not found: {step_id}")

    target["status"] = "completed"
    target["completed_at"] = datetime.utcnow().isoformat() + "Z"

    if steps and all(st.get("status") == "completed" for st in steps):
        inst["status"] = "completed"

    _save_back_instance(inst)
    return target
