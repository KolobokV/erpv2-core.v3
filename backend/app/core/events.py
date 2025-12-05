from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any, Awaitable, Callable, Dict, List, Union

logger = logging.getLogger(__name__)

EventHandler = Callable[[str, Dict[str, Any]], Union[None, Awaitable[None]]]


class EventTypes:
    """Centralized list of event type names."""

    TASK_CREATED = "task_created"
    TASK_STATUS_CHANGED = "task_status_changed"
    TASK_OVERDUE = "task_overdue"

    CONTROL_EVENT_TRIGGERED = "control_event_triggered"
    CHAIN_TRIGGERED = "chain_triggered"

    NOTIFICATION_SENT = "notification_sent"

    EMAIL_RECEIVED = "email_received"
    EMAIL_ACTION_REQUIRED = "email_action_required"
    EMAIL_ACTION_CREATED = "email_action_created"


class EventSystem:
    """
    Simple in-process pub/sub event system.

    Handlers can be sync or async callables with signature:
        handler(event_type: str, payload: Dict[str, Any]) -> None | Awaitable[None]
    """

    def __init__(self) -> None:
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """
        Register a handler for a given event type.
        Safe to call multiple times with the same handler.
        """
        async with self._lock:
            handlers = self._handlers[event_type]
            if handler not in handlers:
                handlers.append(handler)
                logger.debug("Subscribed handler %r to event %s", handler, event_type)

    async def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Unregister a handler for a given event type."""
        async with self._lock:
            handlers = self._handlers.get(event_type)
            if not handlers:
                return
            if handler in handlers:
                handlers.remove(handler)
                logger.debug("Unsubscribed handler %r from event %s", handler, event_type)
            if not handlers:
                self._handlers.pop(event_type, None)

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        """
        Publish an event to all subscribed handlers.

        Handlers are awaited sequentially. This is intentional to keep
        side effects ordered and easier to debug. If you ever need
        fire-and-forget, build it on top of this primitive.
        """
        async with self._lock:
            handlers = list(self._handlers.get(event_type, []))

        if not handlers:
            logger.debug("No handlers for event %s", event_type)
            return

        for handler in handlers:
            try:
                result = handler(event_type, payload)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                logger.exception("Error while handling event %s in %r", event_type, handler)


_event_system: EventSystem | None = None


def get_event_system() -> EventSystem:
    """
    Global accessor for the singleton EventSystem instance.

    This keeps the event bus process-local and simple.
    """
    global _event_system
    if _event_system is None:
        _event_system = EventSystem()
    return _event_system
