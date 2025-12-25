from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from app.core.control_event_store import list_all_events, list_events

router = APIRouter(
    prefix="/api/internal/control-events-store",
    tags=["internal_control_events_store"],
)


@router.get("/")
def get_all_control_events() -> Dict[str, Any]:
    """
    Return all control events from JSON store.

    Response format:
      {
        "items": [ {event}, {event}, ... ]
      }
    """
    items = list_all_events()
    return {"items": items}


@router.get("/client/{client_id}")
def get_control_events_for_client(
    client_id: str,
    period: Optional[str] = Query(
        default=None,
        description="Optional period filter, usually YYYY-MM",
    ),
) -> Dict[str, Any]:
    """
    Return control events for a given client, optionally filtered by period.

    Response format:
      {
        "items": [ {event}, {event}, ... ]
      }
    """
    items = list_events(client_id=client_id, period=period)
    return {"items": items}
