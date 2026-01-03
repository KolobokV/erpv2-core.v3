from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter

router = APIRouter(prefix="/api/internal", tags=["internal-aliases-v2"])

BASE_DIR = Path(__file__).resolve().parents[2]

PROCESS_INSTANCES_STORE = BASE_DIR / "process_instances_store.json"
CONTROL_EVENTS_STORE = BASE_DIR / "control_events_store.json"


def _read_json_file(path: Path, default: Any) -> Any:
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _normalize_list(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ["items", "instances", "process_instances", "data", "rows"]:
            v = payload.get(key)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
    return []


# ---- process-instances-v2 (frontend expects this) ----

@router.get("/process-instances-v2", summary="List process instances (v2 alias)")
@router.get("/process-instances-v2/", summary="List process instances (v2 alias, slash)")
def list_process_instances_v2() -> List[Dict[str, Any]]:
    raw = _read_json_file(PROCESS_INSTANCES_STORE, default=[])
    return _normalize_list(raw)


# ---- control-events-store (frontend expects this) ----

@router.get("/control-events-store", summary="Control events store (alias)")
@router.get("/control-events-store/", summary="Control events store (alias, slash)")
@router.get("/control-events-store-v2", summary="Control events store v2 (alias)")
@router.get("/control-events-store-v2/", summary="Control events store v2 (alias, slash)")
def get_control_events_store() -> Any:
    # Return raw payload to preserve structure expected by UI
    return _read_json_file(CONTROL_EVENTS_STORE, default=[])
