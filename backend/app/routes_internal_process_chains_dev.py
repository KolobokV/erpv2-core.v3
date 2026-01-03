from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/internal/process-chains/dev", tags=["internal-process-chains-dev"])

BASE_DIR = Path(__file__).resolve().parents[2]
RUNS_STORE_PATH = BASE_DIR / "process_chains_runs_store.json"


def _read_json(path: Path, default: Any) -> Any:
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _as_list(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ["items", "runs", "data", "rows"]:
            v = payload.get(key)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
    return []


@router.get("", summary="List dev chain runs (no slash)")
@router.get("/", summary="List dev chain runs")
def list_runs() -> List[Dict[str, Any]]:
    raw = _read_json(RUNS_STORE_PATH, default=[])
    return _as_list(raw)


@router.post("/run-for-client/{client_id}", summary="Run process chains for client (stub compat endpoint)")
def run_for_client(
    client_id: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    # Stub endpoint: keep frontend dev page working without 404.
    # In future this should trigger real chain execution.
    now = datetime.utcnow().isoformat() + "Z"
    entry: Dict[str, Any] = {
        "ts": now,
        "client_id": str(client_id),
        "year": year,
        "month": month,
        "status": "ok",
        "note": "stub",
    }

    existing = _as_list(_read_json(RUNS_STORE_PATH, default=[]))
    existing.insert(0, entry)
    _write_json(RUNS_STORE_PATH, existing[:2000])

    return {"status": "ok", "run": entry}
