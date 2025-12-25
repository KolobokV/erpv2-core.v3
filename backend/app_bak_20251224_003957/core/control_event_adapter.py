from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.core.control_event_store import add_event_from_chain
from app.core.control_event_dispatcher import dispatch_control_event

logger = logging.getLogger(__name__)


def create_control_event_from_chain(
    *,
    client_id: Optional[str],
    profile_code: str,
    period: str,
    event_code: str,
    payload: Dict[str, Any],
) -> None:
    """
    Adapter between chains and control events engine.

    Steps:
      1) Persist event into JSON control events store.
      2) Log the fact of creation.
      3) Optionally forward into a dedicated service function if it exists.
      4) Dispatch event to internal control-event handlers.
    """
    safe_payload: Dict[str, Any] = dict(payload or {})

    event = add_event_from_chain(
        client_id=client_id,
        profile_code=profile_code,
        period=period,
        event_code=event_code,
        payload=safe_payload,
        source="chain",
    )

    logger.info(
        "CONTROL_EVENT_FROM_CHAIN: stored_id=%s client_id=%s profile_code=%s period=%s event_code=%s",
        event["id"],
        client_id,
        profile_code,
        period,
        event_code,
    )

    # Optional forwarding into a service layer, if present.
    try:
        from app import control_events_service as svc  # type: ignore[import]
    except Exception:
        svc = None

    if svc is not None:
        try:
            handler = getattr(svc, "create_event_from_chain", None)
            if handler is not None:
                handler(
                    client_id=client_id,
                    profile_code=profile_code,
                    period=period,
                    event_code=event_code,
                    payload=safe_payload,
                    stored_event=event,
                )
        except Exception as exc:
            logger.warning("CONTROL_EVENT_FORWARD_TO_SERVICE_FAILED: %s", exc)

    # Internal dispatch for control-event handlers.
    try:
        dispatch_control_event(event)
    except Exception as exc:
        logger.warning("CONTROL_EVENT_DISPATCH_EXCEPTION: %s", exc)
