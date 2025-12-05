from __future__ import annotations

from fastapi import FastAPI

from app.core.event_handlers import register_default_event_handlers
from app.core.chain_registry import register_builtin_chains


async def init_app_events(app: FastAPI) -> None:
    """
    Initialize application event handlers and chain registry.

    This is called once on application startup.
    """
    # Register builtin chains first
    register_builtin_chains()

    # Then subscribe event handlers
    await register_default_event_handlers()
