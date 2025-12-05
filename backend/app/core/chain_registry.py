from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger("app.chains.registry")

ChainHandler = Callable[[Dict[str, Any]], Awaitable[None] | None]

_chain_registry: Dict[str, ChainHandler] = {}


def register_chain(chain_id: str, handler: ChainHandler) -> None:
    """
    Register a handler for a given chain id.

    Handler signature:
        handler(context: Dict[str, Any]) -> None | Awaitable[None]
    """
    if not chain_id:
        raise ValueError("chain_id must be a non-empty string")

    _chain_registry[chain_id] = handler
    logger.info("Registered chain handler for chain_id=%s", chain_id)


def get_chain_handler(chain_id: str) -> Optional[ChainHandler]:
    """Return handler for a given chain id, or None if not registered."""
    return _chain_registry.get(chain_id)


def register_builtin_chains() -> None:
    """
    Register a small set of builtin chains.

    For now this only contains a debug chain that logs the context.
    It is safe for use in any environment.
    """

    async def debug_log_chain(context: Dict[str, Any]) -> None:
        logger.info("Builtin debug.log chain executed with context=%r", context)

    register_chain("debug.log", debug_log_chain)
