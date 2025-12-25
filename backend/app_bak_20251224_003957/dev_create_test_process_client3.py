import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple


DEV_CLIENT_ID = "ooo_usn_dr_tour_zp520"
DEV_PROFILE_CODE = "ooo_usn_dr_tour_zp520"


def get_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def get_current_period() -> str:
    now = datetime.utcnow()
    return f"{now.year:04d}-{now.month:02d}"


def load_instances_store(path: Path) -> Tuple[List[Dict[str, Any]], bool]:
    if not path.exists():
        return [], False

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    # Support both plain list and {"items": [...]}
    if isinstance(data, list):
        return data, False

    if isinstance(data, dict) and isinstance(data.get("items"), list):
        return list(data["items"]), True

    raise ValueError("Unexpected process_instances_store format")


def save_instances_store(path: Path, items: List[Dict[str, Any]], wrapped: bool) -> None:
    if wrapped:
        out: Any = {"items": items}
    else:
        out = items

    tmp_path = path.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    tmp_path.replace(path)


def compute_status_from_steps(steps: List[Dict[str, Any]]) -> str:
    if not steps:
        return "open"

    has_error = any((step.get("status") or "").lower() == "error" for step in steps)
    if has_error:
        return "error"

    normalized = [(step.get("status") or "").lower() for step in steps]
    if all(s == "completed" for s in normalized if s):
        return "completed"

    has_active = any(s in ("open", "waiting", "pending") for s in normalized)
    if has_active:
        return "waiting"

    return "open"


def ensure_default_steps(instance: Dict[str, Any]) -> None:
    steps = instance.get("steps") or []
    if steps:
        # Do not touch existing steps in dev mode
        return

    now_iso = get_now_iso()
    default_templates = [
        {
            "title": "Request bank statements",
            "status": "open",
        },
        {
            "title": "Request primary documents",
            "status": "waiting",
        },
        {
            "title": "Prepare tax and reports",
            "status": "open",
        },
    ]

    new_steps: List[Dict[str, Any]] = []
    for tmpl in default_templates:
        new_steps.append(
            {
                "id": str(uuid.uuid4()),
                "title": tmpl["title"],
                "status": tmpl["status"],
                "created_at": now_iso,
                "completed_at": None,
            }
        )

    instance["steps"] = new_steps

    status = compute_status_from_steps(new_steps)
    instance["status"] = status
    instance["computed_status"] = status


def upsert_dev_instance(
    items: List[Dict[str, Any]],
    client_id: str,
    profile_code: str,
    period: str,
) -> Dict[str, Any]:
    key = f"{client_id}::{profile_code}::{period}"

    for inst in items:
        if inst.get("key") == key:
            # Existing instance: only ensure steps
            ensure_default_steps(inst)
            inst["updated_at"] = get_now_iso()
            return inst

    now_iso = get_now_iso()
    new_inst: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "key": key,
        "client_id": client_id,
        "profile_code": profile_code,
        "period": period,
        "status": "open",
        "computed_status": "open",
        "source": "dev_create_test_process_client3",
        "events": [],
        "last_event_code": "dev_test_process_run",
        "steps": [],
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    ensure_default_steps(new_inst)
    items.append(new_inst)
    return new_inst


def main() -> None:
    base_dir = Path(__file__).resolve().parent.parent
    store_path = base_dir / "process_instances_store.json"

    print(f"[INFO] Using store: {store_path}")
    items, wrapped = load_instances_store(store_path)
    print(f"[INFO] Loaded {len(items)} instances from store")

    period = get_current_period()
    print(f"[INFO] Target dev instance: client={DEV_CLIENT_ID}, profile={DEV_PROFILE_CODE}, period={period}")

    inst = upsert_dev_instance(items, DEV_CLIENT_ID, DEV_PROFILE_CODE, period)

    print(f"[INFO] Instance id: {inst.get('id')}")
    print(f"[INFO] Instance key: {inst.get('key')}")
    print(f"[INFO] Steps count: {len(inst.get('steps') or [])}")
    print(f"[INFO] Instance status: {inst.get('status')} / {inst.get('computed_status')}")

    save_instances_store(store_path, items, wrapped)
    print("[OK] Dev process instance for client3 updated")


if __name__ == "__main__":
    main()
