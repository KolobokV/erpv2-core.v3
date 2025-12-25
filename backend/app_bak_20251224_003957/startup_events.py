from __future__ import annotations

import logging
from fastapi import FastAPI

from app.core.events import get_event_system
from app.core.scheduler_reglament import start_reglament_scheduler

logger = logging.getLogger(__name__)


def register_startup_events(app: FastAPI) -> None:
    @app.on_event("startup")
    async def on_startup() -> None:
        _ = get_event_system()
        logger.info("APP_STARTUP_EVENTS_REGISTERED")
        try:
            start_reglament_scheduler()
            logger.info("REGLEMENT_SCHEDULER_START_REQUESTED")
        except Exception:
            logger.exception("REGLEMENT_SCHEDULER_START_FAILED")


def register_shutdown_events(app: FastAPI) -> None:
    @app.on_event("shutdown")
    async def on_shutdown() -> None:
        logger.info("APP_SHUTDOWN_EVENTS_TRIGGERED")
