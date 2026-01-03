from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/control-events", tags=["control-events"])

BASE_DIR = Path(__file__).resolve().parents[2]
CONTROL_EVENTS_STORE = BASE_DIR / "control_events_store.json"


def _read_json(path: Path, default: Any) -> Any:
    try:
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _as_list(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in ["items", "events", "control_events", "data", "rows"]:
            v = payload.get(key)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
    return []


def _extract_client_id(ev: Dict[str, Any]) -> Optional[str]:
    for k in ["client_id", "clientId", "client", "client_key", "clientKey"]:
        v = ev.get(k)
        if v is not None:
            return str(v)
    return None


def _extract_date(ev: Dict[str, Any]) -> Optional[datetime]:
    for k in ["date", "due_date", "dueDate", "deadline", "run_date", "runDate"]:
        v = ev.get(k)
        if not v:
            continue
        try:
            s = str(v)
            # Accept YYYY-MM-DD or ISO.
            if len(s) >= 10:
                return datetime.fromisoformat(s[:10])
        except Exception:
            continue
    return None


@router.get("/{client_id}", summary="List control events for client (compat endpoint)")
def list_control_events_for_client(
    client_id: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> List[Dict[str, Any]]:
    raw = _read_json(CONTROL_EVENTS_STORE, default=[])
    events = _as_list(raw)

    out: List[Dict[str, Any]] = []
    for ev in events:
        cid = _extract_client_id(ev)
        if cid != str(client_id):
            continue
        dt = _extract_date(ev)
        if dt is None:
            # If date missing, keep it (better than empty UI)
            out.append(ev)
            continue
        if dt.year == year and dt.month == month:
            out.append(ev)
    return out


@router.post("/{client_id}/generate", summary="Generate control events for client (stub compat endpoint)")
def generate_control_events_for_client(
    client_id: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    # Placeholder for future: real derive/materialize pipeline.
    # For now we return ok so UI does not 404.
    return {"status": "ok", "generated": 0, "client_id": client_id, "year": year, "month": month}
