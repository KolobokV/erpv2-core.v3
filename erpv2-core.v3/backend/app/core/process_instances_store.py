import json
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


_LOCK = threading.Lock()


def _get_store_path() -> Path:
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


def get_all_instances() -> List[Dict[str, Any]]:
    path = _get_store_path()
    with _LOCK:
        return _load_instances(path)


def find_instance_by_id(instance_id: str) -> Optional[Dict[str, Any]]:
    path = _get_store_path()
    with _LOCK:
        for inst in _load_instances(path):
            if inst.get("id") == instance_id:
                return inst
    return None


def _save_back_instance(instance: Dict[str, Any]) -> None:
    path = _get_store_path()
    now = datetime.utcnow().isoformat() + "Z"

    with _LOCK:
        items = _load_instances(path)
        for i, it in enumerate(items):
            if it.get("id") == instance["id"]:
                instance["updated_at"] = now
                items[i] = instance
                break
        _save_instances(path, items)


# --------------------------
# E2.5 — PROCESS STEPS
# --------------------------

def add_step(instance_id: str, title: str) -> Dict[str, Any]:
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

    # auto finish instance
    if all(st.get("status") == "completed" for st in steps):
        inst["status"] = "completed"

    _save_back_instance(inst)
    return target
