from __future__ import annotations

import inspect
import logging
from typing import Any, Dict, Optional

from .chain_registry import ChainHandler, get_chain_handler

logger = logging.getLogger(__name__)


class ChainExecutor:
    """
    Simple executor for running registered chains.

    It resolves a handler by chain_id from chain_registry and executes it with:
        client_id: Optional[str]
        context: Dict[str, Any]
    """

    async def run_chain(
        self,
        chain_id: str,
        client_id: Optional[str],
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not chain_id:
            logger.warning("Attempt to run chain with empty id")
            return

        handler: Optional[ChainHandler] = get_chain_handler(chain_id)
        if handler is None:
            logger.info(
                "No handler registered for chain_id=%s; nothing to execute",
                chain_id,
            )
            return

        ctx: Dict[str, Any] = context or {}
        logger.info(
            "Starting chain execution: chain_id=%s, client_id=%s, context_keys=%s",
            chain_id,
            client_id,
            list(ctx.keys()),
        )

        try:
            if inspect.iscoroutinefunction(handler):
                await handler(client_id, ctx)
            else:
                result = handler(client_id, ctx)
                if inspect.isawaitable(result):
                    await result  # type: ignore[func-returns-value]
        except Exception as exc:
            logger.exception(
                "Error while executing chain %s for client_id=%s: %s",
                chain_id,
                client_id,
                exc,
            )
            return

        logger.info(
            "Finished chain execution: chain_id=%s, client_id=%s",
            chain_id,
            client_id,
        )
