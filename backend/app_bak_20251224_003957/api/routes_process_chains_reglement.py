from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from app.services.chain_executor_v2 import run_reglament_for_period

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RUNS_PATH = BASE_DIR / "chain_runs_store.json"

router = APIRouter(
    prefix="/api/internal/process-chains/reglement",
    tags=["internal.process_chains_reglement"],
)


def _load_runs_store() -> Dict[str, Any]:
    """
    Load chain_runs_store.json in a tolerant way.

    Supported formats:
      - {"runs": [ ... ]}
      - [ ... ]  (will be wrapped into {"runs": [...]})
    """
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


def _validate_period(year: int, month: int) -> None:
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=422, detail="Invalid year")
    if month < 1 or month > 12:
        raise HTTPException(status_code=422, detail="Invalid month")


@router.post("/run")
async def run_reglement(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    """
    Run full monthly reglament for all clients for given year/month.

    This is the main entry point for production reglament runs.
    It is safe to call multiple times: engine should be idempotent.
    """
    _validate_period(year, month)

    started_at = datetime.utcnow().isoformat() + "Z"

    status: str = "ok"
    error_message: str | None = None
    result: Any = None

    try:
        result = await run_reglament_for_period(year=year, month=month)
    except Exception as exc:
        # We intentionally do not raise 500 to keep API stable for UI.
        status = "error"
        error_message = str(exc)

    finished_at = datetime.utcnow().isoformat() + "Z"

    store = _load_runs_store()
    runs = store.get("runs", [])

    run_record: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "mode": "reglement",
        "year": year,
        "month": month,
        "status": status,
        "error": error_message,
        "engine": "chain_executor_v2",
        "started_at": started_at,
        "finished_at": finished_at,
        "result": result,
    }

    runs.append(run_record)
    store["runs"] = runs
    _save_runs_store(store)

    return {
        "status": status,
        "run": run_record,
    }
