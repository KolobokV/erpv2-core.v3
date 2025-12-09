import uuid
import logging
from datetime import datetime
from typing import Any, Dict, List

from app.core.store_json import load_json_store, save_json_store
from app.services.process_to_tasks import generate_tasks_from_process

CHAIN_RUNS_STORE = "chain_runs_store.json"
INSTANCES_STORE = "process_instances_store.json"


def _load_runs_store() -> Dict[str, Any]:
    try:
        raw = load_json_store(CHAIN_RUNS_STORE, default={"runs": []})
        if isinstance(raw, dict) and isinstance(raw.get("runs"), list):
            return raw
        return {"runs": []}
    except Exception:
        return {"runs": []}


def _save_runs_store(data: Dict[str, Any]) -> None:
    save_json_store(CHAIN_RUNS_STORE, data)


def _append_run_entry(entry: Dict[str, Any]) -> None:
    store = _load_runs_store()
    runs = store.get("runs", [])
    runs.append(entry)
    store["runs"] = runs
    _save_runs_store(store)


def _already_executed(chain_id: str, client_id: str, period: str) -> bool:
    store = _load_runs_store()
    for r in store.get("runs", []):
        if (
            r.get("chain_id") == chain_id and
            r.get("client_id") == client_id and
            r.get("period") == period and
            r.get("status") == "completed"
        ):
            return True
    return False


def _load_instances() -> List[Dict[str, Any]]:
    raw = load_json_store(INSTANCES_STORE, default={"instances": []})
    if isinstance(raw, dict) and isinstance(raw.get("instances"), list):
        return raw["instances"]
    return []


def execute_instances_phase(client_id: str, year: int, month: int) -> int:
    """
    Phase: generate or update process instances via dev script or definitions.
    Currently we only count existing instances for summary.
    In v3 this function can contain real instance generation logic.
    """
    instances = _load_instances()
    period_key = f"{year:04d}-{month:02d}"
    count = 0
    for inst in instances:
        if inst.get("client_code") == client_id and inst.get("period") == period_key:
            count += 1
    return count


def execute_tasks_phase(client_id: str, year: int, month: int) -> int:
    """
    Phase: generate tasks from process instances.
    Uses generate_tasks_from_process service.
    """
    result = generate_tasks_from_process(client_id, year, month)
    return int(result.get("created", 0))


async def execute_chain(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Unified chain executor v2. Sequential and synchronous.
    Payload fields:
        chain_id: str
        client_id: str
        period: "YYYY-MM"
        mode: "dev" | "reglament"
        trigger: "scheduler" | "api"
    """
    chain_id = payload.get("chain_id")
    client_id = payload.get("client_id")
    period = payload.get("period")
    mode = payload.get("mode", "reglament")
    trigger = payload.get("trigger", "scheduler")

    if not chain_id or not client_id or not period:
        raise ValueError("Invalid chain payload")

    # Parse year-month
    try:
        year, month = period.split("-")
        year_i = int(year)
        month_i = int(month)
    except Exception:
        raise ValueError("Invalid period format")

    # Idempotency
    if _already_executed(chain_id, client_id, period):
        return {
            "id": None,
            "chain_id": chain_id,
            "client_id": client_id,
            "period": period,
            "mode": mode,
            "trigger": trigger,
            "status": "skipped",
            "reason": "already_completed"
        }

    run_id = str(uuid.uuid4())
    started_at = datetime.utcnow().isoformat() + "Z"
    status = "running"
    error_msg = None
    steps_generated = 0
    tasks_generated = 0

    # Run entry (initial)
    base_entry = {
        "id": run_id,
        "chain_id": chain_id,
        "client_id": client_id,
        "period": period,
        "mode": mode,
        "trigger": trigger,
        "status": status,
        "started_at": started_at,
        "finished_at": None,
        "steps_generated": 0,
        "tasks_generated": 0,
        "error": None,
    }

    try:
        # Phase 1: instances phase
        steps_generated = execute_instances_phase(client_id, year_i, month_i)

        # Phase 2: tasks generation
        tasks_generated = execute_tasks_phase(client_id, year_i, month_i)

        status = "completed"

    except Exception as exc:
        status = "error"
        error_msg = repr(exc)

    finished_at = datetime.utcnow().isoformat() + "Z"

    final_entry = base_entry.copy()
    final_entry.update(
        {
            "status": status,
            "finished_at": finished_at,
            "steps_generated": steps_generated,
            "tasks_generated": tasks_generated,
            "error": error_msg,
        }
    )

    _append_run_entry(final_entry)
    return final_entry
