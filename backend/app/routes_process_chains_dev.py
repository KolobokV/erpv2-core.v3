import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Query

from app.services.chain_executor_v2 import execute_chain

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RUNS_PATH = BASE_DIR / "chain_runs_store.json"

router = APIRouter(
    prefix="/api/internal/process-chains/dev",
    tags=["internal.process_chains_dev"],
)


def _load_runs_store() -> Dict[str, Any]:
    if not RUNS_PATH.exists():
        return {"runs": []}
    try:
        raw = RUNS_PATH.read_text(encoding="utf-8-sig")
    except Exception:
        raw = RUNS_PATH.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except Exception:
        return {"runs": []}
    if isinstance(data, list):
        return {"runs": data}
    if isinstance(data, dict) and isinstance(data.get("runs"), list):
        return data
    return {"runs": []}


def _save_runs_store(store: Dict[str, Any]) -> None:
    RUNS_PATH.write_text(
        json.dumps(store, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


@router.get("/")
async def dev_runs_list() -> List[Dict[str, Any]]:
    """
    History of dev runs from chain_runs_store.json.
    """
    store = _load_runs_store()
    return store.get("runs", [])


@router.post("/run-for-client/{client_code}")
async def dev_run_post(
    client_code: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    """
    Run chain executor v2 for single client/period in dev mode
    and append record to chain_runs_store.json.
    """
    started_at = datetime.utcnow().isoformat() + "Z"

    payload = {
        "mode": "dev",
        "client_code": client_code,
        "year": year,
        "month": month,
    }

    result: Dict[str, Any] = await execute_chain(payload)

    finished_at = datetime.utcnow().isoformat() + "Z"

    store = _load_runs_store()
    runs = store.get("runs", [])

    run_record: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "mode": "dev",
        "client_id": client_code,
        "year": year,
        "month": month,
        "status": "ok",
        "error": None,
        "engine": "chain_executor_v2",
        "started_at": started_at,
        "finished_at": finished_at,
        "result": result,
    }

    runs.append(run_record)
    store["runs"] = runs
    _save_runs_store(store)

    # Response keeps "status" for UI message and returns result details.
    return {
        "status": "ok",
        "run": run_record,
    }
