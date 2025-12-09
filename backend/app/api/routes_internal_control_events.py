import uuid
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from app.core.store_json import load_json_store, save_json_store

CONTROL_EVENTS_STORE = "control_events_store.json"

router = APIRouter(
    prefix="/api/internal/control-events",
    tags=["internal.control_events"]
)

def _load_events() -> Dict[str, Any]:
    data = load_json_store(CONTROL_EVENTS_STORE, default={"events": []})
    if isinstance(data, dict) and isinstance(data.get("events"), list):
        return data
    return {"events": []}

def _save_events(data: Dict[str, Any]):
    save_json_store(CONTROL_EVENTS_STORE, data)

@router.get("/")
def list_all():
    store = _load_events()
    return store.get("events", [])

@router.get("/{event_id}")
def get_event(event_id: str):
    store = _load_events()
    for ev in store.get("events", []):
        if ev.get("id") == event_id:
            return ev
    raise HTTPException(404, "Not found")

@router.post("/{event_id}/status")
def update_status(event_id: str, payload: Dict[str, Any]):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(400, "Missing status")

    store = _load_events()
    events = store.get("events", [])

    for ev in events:
        if ev.get("id") == event_id:
            ev["status"] = new_status
            ev["updated_at"] = datetime.utcnow().isoformat() + "Z"
            _save_events(store)
            return ev

    raise HTTPException(404, "Not found")

@router.delete("/{event_id}")
def delete(event_id: str):
    store = _load_events()
    events = store.get("events", [])
    store["events"] = [ev for ev in events if ev.get("id") != event_id]
    _save_events(store)
    return {"deleted": True}
