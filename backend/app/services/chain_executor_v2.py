import json
import logging
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent

STORE_INSTANCES = BASE_DIR / "process_instances_store.json"
STORE_TEMPLATES = BASE_DIR / "process_step_templates_store.json"
STORE_PROFILES = BASE_DIR / "client_profiles_store.json"
STORE_EVENTS = BASE_DIR / "control_events_store.json"
STORE_EVENT_TEMPLATES = BASE_DIR / "control_events_templates_store.json"
STORE_TASKS = BASE_DIR / "tasks_store.json"


def _safe_load(path: Path, default):
    try:
        if not path.exists():
            return default
        txt = path.read_text(encoding="utf-8-sig")
        return json.loads(txt)
    except Exception as exc:
        logger.warning("Failed to load %s: %s", path, exc)
        return default


def _safe_save(path: Path, data: Any):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_profiles():
    return _safe_load(STORE_PROFILES, {"profiles": []})


def _load_templates():
    tpl = _safe_load(STORE_TEMPLATES, None)
    if not tpl:
        logger.warning("Fallback default templates")
        return [{"step_id": f"def_{i}", "name": f"Default {i}", "type": "generic"} for i in range(1, 10)]
    return tpl


def _load_instances():
    data = _safe_load(STORE_INSTANCES, {})
    if isinstance(data, dict):
        return data
    logger.warning("process_instances_store.json has non-dict root, resetting to empty mapping")
    return {}


def _load_event_templates():
    return _safe_load(STORE_EVENT_TEMPLATES, {"templates": []})


def _load_events():
    return _safe_load(STORE_EVENTS, {"events": []})


def _load_tasks():
    return _safe_load(STORE_TASKS, {"tasks": []})


def _save_instances(data):
    _safe_save(STORE_INSTANCES, data)


def _save_events(data):
    _safe_save(STORE_EVENTS, data)


def _save_tasks(data):
    _safe_save(STORE_TASKS, data)


# ===========================================================
# CONTROL EVENTS GENERATION
# ===========================================================
def _generate_control_events_for_client_period(profile: Dict[str, Any], year: int, month: int):
    templates = _load_event_templates().get("templates", [])
    if not templates:
        return []

    events_store = _load_events()
    events = events_store.get("events", [])

    client = profile["code"]
    period = f"{year}-{month:02d}"

    new_events: List[Dict[str, Any]] = []

    def event_exists(code: str) -> bool:
        for ev in events:
            ev_client = ev.get("client_code") or ev.get("client_id")
            if ev_client == client and ev.get("period") == period and (ev.get("type") == code or ev.get("code") == code):
                return True
        return False

    def add_event(code: str):
        if event_exists(code):
            return
        tpl = next((x for x in templates if x["code"] == code), None)
        if not tpl:
            return
        e = {
            "id": f"evt-{code}-{client}-{period}",
            "client_code": client,
            "period": period,
            "type": code,
            "label": tpl["label"],
            "status": "new"
        }
        events.append(e)
        new_events.append(e)

    add_event("bank_statement")
    add_event("document_request")

    if profile.get("profile_type") == "usn_dr":
        add_event("usn_advance")

    if profile.get("has_salary"):
        add_event("salary")
        add_event("ndfl")
        add_event("insurance")

    if profile.get("has_tourist_tax"):
        add_event("tourist_tax")

    events_store["events"] = events
    _save_events(events_store)

    return new_events


# ===========================================================
# TASK GENERATION
# ===========================================================
def _generate_tasks_for_events(events: List[Dict[str, Any]]):
    tasks_store = _load_tasks()
    tasks = tasks_store.get("tasks", [])

    new_tasks: List[Dict[str, Any]] = []

    existing_ids = {t.get("id") for t in tasks}

    for e in events:
        task_id = f"task-{e['id']}"
        if task_id in existing_ids:
            continue
        t = {
            "id": task_id,
            "client_code": e["client_code"],
            "client_label": e.get("client_label") or e["client_code"],
            "event_id": e["id"],
            "title": f"Task for {e['label']} ({e['period']})",
            "status": "new",
            "priority": "normal"
        }
        tasks.append(t)
        new_tasks.append(t)
        existing_ids.add(task_id)

    tasks_store["tasks"] = tasks
    _save_tasks(tasks_store)

    return new_tasks


# ===========================================================
# DEV MODE: run for single client
# ===========================================================
async def run_dev_for_client(client_code: str, year: int, month: int):
    profiles = _load_profiles().get("profiles", [])
    profile = next((p for p in profiles if p["code"] == client_code), None)
    if not profile:
        raise ValueError(f"Unknown client_code={client_code}")

    instances = _load_instances()
    templates = _load_templates()

    key = f"{client_code}::{year}-{month:02d}"

    instances[key] = {
        "client_code": client_code,
        "year": year,
        "month": month,
        "steps": templates,
        "status": "completed"
    }
    _save_instances(instances)

    events = _generate_control_events_for_client_period(profile, year, month)
    _generate_tasks_for_events(events)

    return {
        "mode": "dev",
        "instance_key": key,
        "events_created": len(events),
        "tasks_created": len(events)
    }


# ===========================================================
# REGLAMENT: mass generation
# ===========================================================
async def run_reglament_for_period(year: int, month: int):
    profiles = _load_profiles().get("profiles", [])
    instances = _load_instances()
    templates = _load_templates()

    total_events = 0
    total_instances = 0

    for profile in profiles:
        client = profile["code"]
        key = f"{client}::{year}-{month:02d}"

        instances[key] = {
            "client_code": client,
            "year": year,
            "month": month,
            "steps": templates,
            "status": "completed"
        }
        total_instances += 1

        events = _generate_control_events_for_client_period(profile, year, month)
        _generate_tasks_for_events(events)
        total_events += len(events)

    _save_instances(instances)

    return {
        "mode": "reglament",
        "period": f"{year}-{month:02d}",
        "process_instances": total_instances,
        "events_created": total_events,
        "tasks_created": total_events
    }


# ===========================================================
# PUBLIC ENTRYPOINT
# ===========================================================
async def execute_chain(payload: Dict[str, Any]):
    mode = payload.get("mode", "dev")
    client = payload.get("client_code")
    year = payload.get("year")
    month = payload.get("month")

    if not year or not month:
        raise ValueError("year and month are required")

    if mode == "reglament":
        return await run_reglament_for_period(int(year), int(month))

    if not client:
        raise ValueError("client_code is required for dev mode")

    return await run_dev_for_client(str(client), int(year), int(month))
