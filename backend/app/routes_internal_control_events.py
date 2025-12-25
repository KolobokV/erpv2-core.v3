from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/internal/control-events", tags=["internal-control-events"])

# We assume control_events_store.json is located in the project root (next to app/)
BASE_DIR = Path(__file__).resolve().parents[2]
CONTROL_EVENTS_STORE_PATH = BASE_DIR / "control_events_store.json"


class EventStatusUpdate(BaseModel):
  status: str


def _load_events_store() -> tuple[List[Dict[str, Any]], Any, Optional[str]]:
  """
  Load control events from CONTROL_EVENTS_STORE_PATH in a tolerant way.

  Returns:
      (events_list, container, key_name)

      - events_list: list of event dicts
      - container: original loaded object (list or dict)
      - key_name:
          * if container is dict and events are under container[key_name]
          * if container is list, key_name is None and container is events_list itself
  """
  if not CONTROL_EVENTS_STORE_PATH.exists():
    return [], [], None

  with CONTROL_EVENTS_STORE_PATH.open("r", encoding="utf-8") as f:
    try:
      data = json.load(f)
    except Exception:
      # Broken JSON -> treat as empty
      return [], [], None

  # Plain list
  if isinstance(data, list):
    events_list = [e for e in data if isinstance(e, dict)]
    return events_list, events_list, None

  # Dict with known list keys
  if isinstance(data, dict):
    for key in ["items", "events"]:
      val = data.get(key)
      if isinstance(val, list):
        events_list = [e for e in val if isinstance(e, dict)]
        return events_list, data, key

  # Unknown shape -> do not break other code, return empty but keep container
  return [], data, None


def _save_events_store(
  events: List[Dict[str, Any]],
  container: Any,
  key_name: Optional[str],
) -> None:
  """
  Save events back to CONTROL_EVENTS_STORE_PATH preserving original top-level structure.
  """
  if isinstance(container, list):
    data_to_write = events
  elif isinstance(container, dict) and key_name:
    container[key_name] = events
    data_to_write = container
  else:
    # Fallback: write plain list of events
    data_to_write = events

  CONTROL_EVENTS_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
  with CONTROL_EVENTS_STORE_PATH.open("w", encoding="utf-8") as f:
    json.dump(data_to_write, f, ensure_ascii=False, indent=2)


def _find_event_by_id(events: List[Dict[str, Any]], event_id: str) -> Optional[Dict[str, Any]]:
  for e in events:
    eid = e.get("id")
    if eid is not None and str(eid) == str(event_id):
      return e
  return None


@router.get("/", summary="List all control events (internal view)")
def list_control_events() -> List[Dict[str, Any]]:
  events, _, _ = _load_events_store()
  return events


@router.get("/{event_id}", summary="Get single control event by id")
def get_control_event(event_id: str) -> Dict[str, Any]:
  events, _, _ = _load_events_store()
  event = _find_event_by_id(events, event_id)
  if not event:
    raise HTTPException(status_code=404, detail="Control event not found")
  return event


@router.post(
  "/{event_id}/status",
  summary="Update status of a control event",
)
def update_control_event_status(event_id: str, payload: EventStatusUpdate) -> Dict[str, Any]:
  events, container, key_name = _load_events_store()
  if not events:
    raise HTTPException(status_code=404, detail="Control events store is empty")

  event = _find_event_by_id(events, event_id)
  if not event:
    raise HTTPException(status_code=404, detail="Control event not found")

  # Update status
  event["status"] = payload.status

  # Optional: update timestamp field if present
  now_iso = datetime.utcnow().isoformat() + "Z"
  if "updated_at" in event:
    event["updated_at"] = now_iso

  # Persist changes
  _save_events_store(events, container, key_name)

  return {"status": "ok", "event": event}


@router.delete(
  "/{event_id}",
  summary="Delete control event by id",
)
def delete_control_event(event_id: str) -> Dict[str, Any]:
  events, container, key_name = _load_events_store()
  if not events:
    raise HTTPException(status_code=404, detail="Control events store is empty")

  before_count = len(events)
  events = [e for e in events if str(e.get("id")) != str(event_id)]
  after_count = len(events)

  if before_count == after_count:
    raise HTTPException(status_code=404, detail="Control event not found")

  _save_events_store(events, container, key_name)

  return {"status": "ok", "deleted": 1}
