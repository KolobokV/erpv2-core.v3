from __future__ import annotations

import logging
from typing import Any, Dict

from app.core.events import EventTypes, get_event_system
from app.core.chain_executor import ChainExecutor

logger = logging.getLogger("app.events")

chain_executor = ChainExecutor()


async def handle_task_created(event_type: str, payload: Dict[str, Any]) -> None:
    """
    Basic handler for TASK_CREATED events.

    Currently it only logs the event. Later it can:
    - update analytics,
    - schedule notifications,
    - trigger chains.
    """
    task_id = payload.get("task_id")
    client_id = payload.get("client_id")
    assigned_to = payload.get("assigned_to")
    status = payload.get("status")

    logger.info(
        "TASK_CREATED: task_id=%s client_id=%s assigned_to=%s status=%s",
        task_id,
        client_id,
        assigned_to,
        status,
    )


async def handle_task_status_changed(event_type: str, payload: Dict[str, Any]) -> None:
    """
    Basic handler for TASK_STATUS_CHANGED events.
    """
    task_id = payload.get("task_id")
    client_id = payload.get("client_id")
    old_status = payload.get("old_status")
    new_status = payload.get("new_status")

    logger.info(
        "TASK_STATUS_CHANGED: task_id=%s client_id=%s %s -> %s",
        task_id,
        client_id,
        old_status,
        new_status,
    )


async def handle_task_overdue(event_type: str, payload: Dict[str, Any]) -> None:
    """
    Handler for TASK_OVERDUE events.

    For now it only logs the event. Later this is the right place to:
    - escalate overdue tasks,
    - create follow-up tasks,
    - notify managers.
    """
    task_id = payload.get("task_id")
    client_id = payload.get("client_id")
    assigned_to = payload.get("assigned_to")
    deadline = payload.get("deadline")

    logger.warning(
        "TASK_OVERDUE: task_id=%s client_id=%s assigned_to=%s deadline=%s",
        task_id,
        client_id,
        assigned_to,
        deadline,
    )


async def handle_chain_triggered(event_type: str, payload: Dict[str, Any]) -> None:
    """
    Entry point for chain execution.

    For now it delegates to ChainExecutor, which is a safe no-op skeleton.
    """
    chain_id = payload.get("chain_id")
    client_id = payload.get("client_id")
    context = payload.get("context", {})

    logger.info(
        "CHAIN_TRIGGERED: chain_id=%s client_id=%s context=%r",
        chain_id,
        client_id,
        context,
    )

    if not chain_id:
        logger.warning("CHAIN_TRIGGERED event without chain_id payload=%r", payload)
        return

    await chain_executor.run_chain(
        chain_id=str(chain_id),
        client_id=str(client_id) if client_id is not None else None,
        context=context,
    )


async def register_default_event_handlers() -> None:
    """
    Register default handlers for core events.

    This function should be called once on application startup.
    """
    events = get_event_system()

    await events.subscribe(EventTypes.TASK_CREATED, handle_task_created)
    await events.subscribe(EventTypes.TASK_STATUS_CHANGED, handle_task_status_changed)
    await events.subscribe(EventTypes.TASK_OVERDUE, handle_task_overdue)
    await events.subscribe(EventTypes.CHAIN_TRIGGERED, handle_chain_triggered)

    logger.info("Default event handlers registered")
