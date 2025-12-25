from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Dict, Optional, Union

logger = logging.getLogger(__name__)

ChainHandlerSync = Callable[[Optional[str], Dict[str, Any]], None]
ChainHandlerAsync = Callable[[Optional[str], Dict[str, Any]], Awaitable[None]]
ChainHandler = Union[ChainHandlerSync, ChainHandlerAsync]

_chain_registry: Dict[str, ChainHandler] = {}


def register_chain(chain_id: str, handler: ChainHandler) -> None:
    """
    Register a chain handler by id.

    Chain handler signature:
        def handler(client_id: Optional[str], context: Dict[str, Any]) -> None | Awaitable[None]
    """
    if not chain_id or not isinstance(chain_id, str):
        raise ValueError("chain_id must be a non-empty string")

    logger.info("Registering chain handler: %s -> %s", chain_id, getattr(handler, "__name__", str(handler)))
    _chain_registry[chain_id] = handler


def get_chain_handler(chain_id: str) -> Optional[ChainHandler]:
    """
    Get a previously registered chain handler by id.
    """
    return _chain_registry.get(chain_id)


def list_registered_chains() -> Dict[str, ChainHandler]:
    """
    Return a copy of all registered chain handlers.
    """
    return dict(_chain_registry)


def register_builtin_chains() -> None:
    """
    Register builtin chains that are always available.

    This function:
    - Registers a simple debug logging chain ("debug.log")
    - Imports reglament chains module so that it can self-register its chains
    """
    def debug_log_chain(client_id: Optional[str], context: Dict[str, Any]) -> None:
        safe_context = context or {}
        logger.info(
            "Chain debug.log executed for client_id=%s with context=%s",
            client_id,
            safe_context,
        )

    register_chain("debug.log", debug_log_chain)

    try:
        from . import reglament_chains  # noqa: F401

        logger.info("Reglament chains module imported successfully")
    except Exception as exc:
        logger.warning("Failed to import reglament_chains: %s", exc)
