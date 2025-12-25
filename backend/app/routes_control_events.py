import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query

CONTROL_EVENTS_STORE_NAME = "control_events_store.json"
CLIENT_PROFILES_STORE_NAME = "client_profiles_store.json"

BASE_DIR = Path(__file__).resolve().parent.parent.parent
EVENTS_PATH = BASE_DIR / CONTROL_EVENTS_STORE_NAME
PROFILES_PATH = BASE_DIR / CLIENT_PROFILES_STORE_NAME

router = APIRouter(
    prefix="/api/control-events",
    tags=["control_events"],
)


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        raw = path.read_text(encoding="utf-8-sig")
    except Exception:
        raw = path.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except Exception:
        return default


def _save_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_events_store() -> Dict[str, Any]:
    data = _load_json(EVENTS_PATH, {"events": []})
    if isinstance(data, list):
        return {"events": data}
    if isinstance(data, dict) and isinstance(data.get("events"), list):
        return data
    return {"events": []}


def _save_events_store(store: Dict[str, Any]) -> None:
    _save_json(EVENTS_PATH, store)


def _load_profiles_store() -> Dict[str, Any]:
    data = _load_json(PROFILES_PATH, {"profiles": []})
    if isinstance(data, list):
        return {"profiles": data}
    if isinstance(data, dict) and isinstance(data.get("profiles"), list):
        return data
    return {"profiles": []}


@router.get("/{client_code}")
def list_events_for_client(
    client_code: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> List[Dict[str, Any]]:
    """
    Return events for given client and period.

    API гарантирует, что в ответе не будет дубликатов событий
    (по идентификатору события).
    """
    store = _load_events_store()
    events = store.get("events", [])
    period = f"{year:04d}-{month:02d}"

    seen_ids = set()
    result: List[Dict[str, Any]] = []

    for ev in events:
        ev_client = ev.get("client_code") or ev.get("client_id")
        ev_period = ev.get("period")
        if ev_client != client_code or ev_period != period:
            continue

        ev_id = ev.get("id")
        if ev_id and ev_id in seen_ids:
            # skip duplicates in store
            continue

        if ev_id:
            seen_ids.add(ev_id)

        result.append(ev)

    return result


@router.post("/{client_code}/generate")
def generate_events_for_client(
    client_code: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    """
    Simple generator: ensures base events exist for client and period.

    Используется как вспомогательный инструмент поверх основной
    генерации через chain executor.
    """
    profiles = _load_profiles_store().get("profiles", [])
    profile = next((p for p in profiles if p.get("code") == client_code), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Unknown client")

    store = _load_events_store()
    events = store.get("events", [])
    period = f"{year:04d}-{month:02d}"

    existing = [
        e
        for e in events
        if (e.get("client_code") or e.get("client_id")) == client_code
        and e.get("period") == period
    ]
    if existing:
        return {"created": 0, "period": period, "client": client_code}

    now_iso = datetime.utcnow().isoformat() + "Z"
    base_types: List[str] = []

    profile_type = profile.get("profile_type")
    has_salary = bool(profile.get("has_salary"))
    has_tourist_tax = bool(profile.get("has_tourist_tax"))

    base_types.extend(["bank_statement", "document_request"])

    if profile_type == "usn_dr":
        base_types.append("usn_advance")

    if has_salary:
        base_types.extend(["salary", "ndfl", "insurance"])

    if has_tourist_tax:
        base_types.append("tourist_tax")

    created = 0
    for ev_type in base_types:
        ev = {
            "id": f"evt-{ev_type}-{client_code}-{period}",
            "client_code": client_code,
            "period": period,
            "type": ev_type,
            "label": ev_type.replace("_", " ").title(),
            "status": "new",
            "created_at": now_iso,
        }
        events.append(ev)
        created += 1

    store["events"] = events
    _save_events_store(store)

    return {"created": created, "period": period, "client": client_code}
