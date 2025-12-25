from pathlib import Path
import json
import datetime
import uuid
from typing import Any, Dict, List

ROOT_DIR = Path(__file__).resolve().parent.parent
CONTROL_EVENTS_PATH = ROOT_DIR / "control_events_store.json"
PROCESS_INSTANCES_PATH = ROOT_DIR / "process_instances_store.json"

CLIENT_ID = "ooo_usn_dr_tour_zp520"
PROFILE_CODE = "ooo_usn_dr_tour_zp520"


def load_json_list(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "items" in data and isinstance(data["items"], list):
            return data["items"]
        return []
    except Exception:
        return []


def save_json_list(path: Path, items: List[Dict[str, Any]]) -> None:
    path.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")


def ensure_ids_unique(items: List[Dict[str, Any]]) -> None:
    seen = set()
    for it in items:
        _id = it.get("id")
        if not _id:
            continue
        if _id in seen:
            it["id"] = f"{_id}__dup"
        else:
            seen.add(_id)


def make_event_id() -> str:
    return "dev_evt_" + uuid.uuid4().hex[:12]


def make_instance_id() -> str:
    return "dev_pi_" + uuid.uuid4().hex[:12]


def compute_period_from_date(date_str: str) -> str:
    try:
        dt = datetime.date.fromisoformat(date_str)
    except Exception:
        dt = datetime.date.today()
    return f"{dt.year:04d}-{dt.month:02d}"


def compute_instance_status_from_steps(steps: List[Dict[str, Any]]) -> str:
    if not steps:
        return "open"
    has_error = any((s.get("status") or "").lower() in ("error", "failed") for s in steps)
    if has_error:
        return "error"
    all_completed = all((s.get("status") or "").lower() == "completed" for s in steps)
    if all_completed:
        return "completed"
    has_waiting = any((s.get("status") or "").lower() in ("waiting", "planned") for s in steps)
    if has_waiting:
        return "waiting"
    return "open"


def upsert_test_event_and_instance() -> None:
    today = datetime.date.today()
    date_str = today.isoformat()
    period = compute_period_from_date(date_str)
    now_iso = datetime.datetime.now().isoformat(timespec="seconds")

    # 1) control event
    control_events = load_json_list(CONTROL_EVENTS_PATH)

    event_id = make_event_id()
    event = {
        "id": event_id,
        "client_id": CLIENT_ID,
        "profile_code": PROFILE_CODE,
        "period": period,
        "event_code": "dev_test_process_run",
        "date": date_str,
        "title": "DEV test process run for client 3",
        "category": "dev",
        "status": "planned",
        "payload": {
            "dev": True,
            "note": "Created by dev_create_test_process_client3 script",
        },
        "source": "dev_script",
        "tags": [
            "dev",
            "process:docs_collect",
            "process:payroll_cycle",
        ],
        "depends_on": [],
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    control_events.append(event)
    ensure_ids_unique(control_events)
    save_json_list(CONTROL_EVENTS_PATH, control_events)

    # 2) process instance
    instances = load_json_list(PROCESS_INSTANCES_PATH)

    key = f"{CLIENT_ID}::{PROFILE_CODE}::{period}"
    instance = None
    for inst in instances:
        if inst.get("key") == key:
            instance = inst
            break

    if instance is None:
        instance = {
            "id": make_instance_id(),
            "key": key,
            "client_id": CLIENT_ID,
            "profile_code": PROFILE_CODE,
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

    # attach event
    events_list = instance.get("events") or []
    if event_id not in events_list:
        events_list.append(event_id)
    instance["events"] = events_list
    instance["last_event_code"] = event["event_code"]

    # demo steps, if none
    steps = instance.get("steps") or []
    if not steps:
        steps = [
            {
                "id": instance["id"] + "::step1",
                "title": "Collect documents from client",
                "status": "completed",
                "created_at": now_iso,
                "completed_at": now_iso,
            },
            {
                "id": instance["id"] + "::step2",
                "title": "Prepare reports and declarations",
                "status": "waiting",
                "created_at": now_iso,
                "completed_at": None,
            },
            {
                "id": instance["id"] + "::step3",
                "title": "Submit reports to authorities",
                "status": "open",
                "created_at": now_iso,
                "completed_at": None,
            },
        ]
    instance["steps"] = steps

    instance_status = compute_instance_status_from_steps(steps)
    instance["status"] = instance_status
    instance["computed_status"] = instance_status
    instance["updated_at"] = now_iso

    save_json_list(PROCESS_INSTANCES_PATH, instances)


if __name__ == "__main__":
    upsert_test_event_and_instance()
    print("DEV test event and process instance created for client:", CLIENT_ID)
