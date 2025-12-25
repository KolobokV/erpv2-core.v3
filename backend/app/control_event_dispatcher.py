from __future__ import annotations

import logging
from typing import Any, Callable, Dict, Optional

from app.core.control_event_store import update_event_fields

logger = logging.getLogger(__name__)

ControlEvent = Dict[str, Any]
EventHandler = Callable[[ControlEvent], None]

_HANDLERS: Dict[str, EventHandler] = {}


def register_event_handler(event_code: str, handler: EventHandler) -> None:
    """
    Register handler for a specific event_code.
    """
    if not event_code:
        return
    _HANDLERS[event_code] = handler
    logger.info("CONTROL_EVENT_HANDLER_REGISTERED: code=%s", event_code)


def dispatch_control_event(event: ControlEvent) -> None:
    """
    Dispatch event to a handler based on event_code.

    If handler is not found, event remains with status 'new'.
    If handler succeeds, status is set to 'handled'.
    If handler fails, status is set to 'error'.
    """
    event_id = str(event.get("id") or "")
    code = str(event.get("event_code") or "")

    if not code:
        logger.debug("CONTROL_EVENT_DISPATCH_SKIP: missing event_code")
        return

    handler: Optional[EventHandler] = _HANDLERS.get(code)
    if handler is None:
        logger.debug("CONTROL_EVENT_DISPATCH_NO_HANDLER: code=%s id=%s", code, event_id)
        return

    try:
        handler(event)
        if event_id:
            update_event_fields(event_id, {"status": "handled"})
        logger.info(
            "CONTROL_EVENT_DISPATCH_HANDLED: code=%s id=%s", code, event_id
        )
    except Exception as exc:
        logger.warning(
            "CONTROL_EVENT_DISPATCH_FAILED: code=%s id=%s error=%s",
            code,
            event_id,
            exc,
        )
        if event_id:
            update_event_fields(event_id, {"status": "error"})


def _handler_monthly_reglament(event: ControlEvent) -> None:
    """
    Demo handler for monthly_reglament events.

    Currently it only logs the fact of handling.
    Real business logic can be plugged here later.
    """
    logger.info(
        "CONTROL_EVENT_HANDLER_MONTHLY_REGLAMENT: id=%s client_id=%s period=%s profile=%s",
        event.get("id"),
        event.get("client_id"),
        event.get("period"),
        event.get("profile_code"),
    )


def register_default_control_event_handlers() -> None:
    """
    Register built-in control event handlers.
    """
    register_event_handler("monthly_reglament", _handler_monthly_reglament)


# Self-registration on import
try:
    register_default_control_event_handlers()
except Exception as exc:
    logger.warning("CONTROL_EVENT_REGISTER_DEFAULT_HANDLERS_FAILED: %s", exc)
