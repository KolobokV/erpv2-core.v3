import logging
from typing import Any, Dict

from app.core.events import EventTypes, get_event_system
from app.services.chain_executor_v2 import execute_chain

logger = logging.getLogger(__name__)


async def handle_chain_triggered(event_type: str, payload: Dict[str, Any]):
    """
    Event handler for CHAIN_TRIGGERED.
    Calls Chain Executor v2 with the provided payload.
    """
    try:
        logger.info("CHAIN_TRIGGERED payload received: %s", payload)
        result = await execute_chain(payload)
        logger.info("CHAIN_EXECUTOR_V2 completed: %s", result)
    except Exception as exc:
        logger.exception("CHAIN_EXECUTOR_V2 failed: %s", exc)


async def register_chain_executor_handler():
    """
    Register CHAIN_TRIGGERED handler inside EventSystem.
    This must be called during FastAPI startup.
    """
    es = get_event_system()
    await es.subscribe(EventTypes.CHAIN_TRIGGERED, handle_chain_triggered)
    logger.info("CHAIN_EXECUTOR_V2 handler subscribed for CHAIN_TRIGGERED")
