from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from app.core.events import get_event_system
from app.core.chain_registry import get_chain_handler

logger = logging.getLogger("app.chains")


class ChainExecutor:
    """
    Core entry point for chain execution.

    Later this class will:
    - load chain definitions from storage,
    - evaluate conditions,
    - execute steps (tasks, notifications, waits),
    - emit events about progress.

    For now it delegates to a simple in-memory registry of chain handlers.
    """

    def __init__(self) -> None:
        self.events = get_event_system()

    async def run_chain(
        self,
        chain_id: str,
        client_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        ctx: Dict[str, Any] = dict(context or {})
        if client_id is not None:
            ctx.setdefault("client_id", client_id)
        ctx.setdefault("chain_id", chain_id)

        logger.info(
            "ChainExecutor: starting chain chain_id=%s client_id=%s context=%r",
            chain_id,
            client_id,
            ctx,
        )

        handler = get_chain_handler(chain_id)
        if handler is None:
            logger.info("No handler registered for chain_id=%s; nothing to execute", chain_id)
            logger.info(
                "ChainExecutor: finished chain chain_id=%s client_id=%s",
                chain_id,
                client_id,
            )
            return

        try:
            result = handler(ctx)
            if asyncio.iscoroutine(result):
                await result
        except Exception:
            logger.exception("Error while executing chain_id=%s", chain_id)

        logger.info(
            "ChainExecutor: finished chain chain_id=%s client_id=%s",
            chain_id,
            client_id,
        )
