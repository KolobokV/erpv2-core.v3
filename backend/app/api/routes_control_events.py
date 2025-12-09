import uuid
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

from app.core.store_json import load_json_store, save_json_store

CONTROL_EVENTS_STORE = "control_events_store.json"
CLIENT_PROFILES_STORE = "client_profiles_store.json"

router = APIRouter(
    prefix="/api/control-events",
    tags=["control_events"]
)

def _load_events() -> Dict[str, Any]:
    data = load_json_store(CONTROL_EVENTS_STORE, default={"events": []})
    if isinstance(data, dict) and isinstance(data.get("events"), list):
        return data
    return {"events": []}

def _save_events(data: Dict[str, Any]):
    save_json_store(CONTROL_EVENTS_STORE, data)

def _load_profiles() -> Dict[str, Any]:
    data = load_json_store(CLIENT_PROFILES_STORE, default={"profiles": []})
    if isinstance(data, dict) and isinstance(data.get("profiles"), list):
        return data
    return {"profiles": []}

@router.get("/{client_code}")
def list_control_events(client_code: str, year: int, month: int):
    period = f"{year:04d}-{month:02d}"
    store = _load_events()
    events = [
        ev for ev in store.get("events", [])
        if ev.get("client_code") == client_code and ev.get("period") == period
    ]
    return events

@router.post("/{client_code}/generate")
def generate_control_events(client_code: str, year: int, month: int):
    period = f"{year:04d}-{month:02d}"

    profiles_store = _load_profiles()
    profile = next((p for p in profiles_store.get("profiles", []) 
                    if p.get("code") == client_code), None)

    if not profile:
        raise HTTPException(404, "Client profile not found")

    base_events = []
    profile_type = profile.get("profile_type")

    if profile_type == "usn_dr":
        base_events.append(("usn_advance", f"{year}-12-25"))
        base_events.append(("bank_statement", f"{year}-{month:02d}-01"))
        base_events.append(("document_request", f"{year}-{month:02d}-02"))

    if profile_type == "osno":
        salary_dates = profile.get("salary_dates", [])
        for d in salary_dates:
            base_events.append(("salary", f"{year}-{month:02d}-{d:02d}"))
        base_events.append(("ndfl", f"{year}-{month:02d}-15"))
        base_events.append(("insurance", f"{year}-{month:02d}-20"))
        base_events.append(("vat", f"{year}-12-25"))

    if profile.get("has_tourist_tax"):
        base_events.append(("tourist_tax", f"{year}-{month:02d}-15"))

    store = _load_events()
    now_events = store.get("events", [])
    created = 0

    for ev_type, due in base_events:
        now_events.append({
            "id": str(uuid.uuid4()),
            "client_code": client_code,
            "type": ev_type,
            "period": period,
            "due_date": due,
            "status": "new",
            "created_at": datetime.utcnow().isoformat() + "Z"
        })
        created += 1

    store["events"] = now_events
    _save_events(store)
    return {"created": created, "period": period, "client": client_code}
