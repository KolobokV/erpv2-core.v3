from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_STORE_LOCK = threading.Lock()


def _get_store_path() -> str:
    """
    Determine filesystem path for JSON control events store.

    Priority:
      1) env CONTROL_EVENTS_STORE_PATH
      2) env ERP_CONTROL_EVENTS_STORE_PATH
      3) ./control_events_store.json in current working directory
    """
    env_path = (
        os.getenv("CONTROL_EVENTS_STORE_PATH")
        or os.getenv("ERP_CONTROL_EVENTS_STORE_PATH")
    )
    if env_path:
        return env_path

    base_dir = os.getcwd()
    return os.path.join(base_dir, "control_events_store.json")


def _load_events(path: Optional[str] = None) -> List[Dict[str, Any]]:
    store_path = path or _get_store_path()

    if not os.path.exists(store_path):
        return []

    try:
        with open(store_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        logger.warning("CONTROL_EVENT_STORE_LOAD_FAILED: %s", exc)
        return []

    if isinstance(data, list):
        return data

    logger.warning(
        "CONTROL_EVENT_STORE_INVALID_ROOT: expected list, got %s", type(data)
    )
    return []


def _save_events(events: List[Dict[str, Any]], path: Optional[str] = None) -> None:
    store_path = path or _get_store_path()
    directory = os.path.dirname(store_path) or "."

    try:
        os.makedirs(directory, exist_ok=True)
    except Exception as exc:
        logger.warning("CONTROL_EVENT_STORE_MKDIR_FAILED: %s", exc)
        return

    tmp_path = store_path + ".tmp"

    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(events, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, store_path)
    except Exception as exc:
        logger.warning("CONTROL_EVENT_STORE_SAVE_FAILED: %s", exc)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def add_event_from_chain(
    *,
    client_id: Optional[str],
    profile_code: str,
    period: str,
    event_code: str,
    payload: Dict[str, Any],
    source: str = "chain",
) -> Dict[str, Any]:
    """
    Append a new control event into JSON store.

    Structure:
      - id: unique identifier
      - client_id: optional client code
      - profile_code: internal profile key (ip_usn_dr, ooo_osno_3_zp1025, etc.)
      - period: arbitrary period string, usually "YYYY-MM"
      - event_code: internal event type key
      - payload: arbitrary JSON-serializable dict
      - source: where this event came from (chain, manual, etc.)
      - status: lifecycle status (new, handled, error, ...)
      - created_at: UTC ISO timestamp
    """
    safe_payload: Dict[str, Any] = dict(payload or {})

    event: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "profile_code": profile_code,
        "period": str(period or ""),
        "event_code": event_code,
        "payload": safe_payload,
        "source": source,
        "status": "new",
        "created_at": _utc_now_iso(),
    }

    with _STORE_LOCK:
        events = _load_events()
        events.append(event)
        _save_events(events)

    logger.info(
        "CONTROL_EVENT_STORE_ADDED: id=%s client_id=%s profile_code=%s period=%s code=%s source=%s",
        event["id"],
        client_id,
        profile_code,
        period,
        event_code,
        source,
    )

    return event


def update_event_fields(event_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update event fields by id using a shallow patch.

    Returns updated event or None if not found.
    """
    if not event_id:
        return None

    with _STORE_LOCK:
        events = _load_events()
        updated: Optional[Dict[str, Any]] = None

        for idx, item in enumerate(events):
            if str(item.get("id")) != str(event_id):
                continue

            new_item = dict(item)
            new_item.update(dict(patch or {}))
            events[idx] = new_item
            updated = new_item
            break

        if updated is not None:
            _save_events(events)

    return updated


def list_events(
    *,
    client_id: Optional[str] = None,
    period: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Return events from JSON store with optional filters.

    Filters:
      - client_id: exact match if provided
      - period: exact match if provided
    """
    with _STORE_LOCK:
        events = _load_events()

    result: List[Dict[str, Any]] = []
    for item in events:
        if client_id is not None and item.get("client_id") != client_id:
            continue
        if period is not None and str(item.get("period")) != str(period):
            continue
        result.append(dict(item))

    return result


def list_all_events() -> List[Dict[str, Any]]:
    """
    Return all events without filters.
    """
    with _STORE_LOCK:
        events = _load_events()

    return [dict(item) for item in events]
