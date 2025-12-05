from __future__ import annotations

import logging
import pkgutil
from importlib import import_module
from typing import Any, Iterable, Optional

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.startup_events import init_app_events
from app.core.scheduler_reglament import start_reglament_scheduler

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="ERPv2 backend")

    # Basic CORS setup for local dev and docker.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _include_all_routers(app)

    @app.on_event("startup")
    async def _on_startup() -> None:  # type: ignore[no-redef]
        logger.info("APP_STARTUP: initializing events and reglement scheduler")
        await init_app_events(app)
        start_reglament_scheduler()

    return app


def _iter_modules(package_name: str) -> Iterable[Any]:
    """
    Yield imported modules for a given top-level package name.
    """
    try:
        base = import_module(package_name)
    except Exception as exc:
        logger.warning("Failed to import package %s: %s", package_name, exc)
        return []

    if not hasattr(base, "__path__"):
        return [base]

    modules = []
    for module_info in pkgutil.walk_packages(base.__path__, base.__name__ + "."):
        try:
            module = import_module(module_info.name)
            modules.append(module)
        except Exception as exc:
            logger.warning("Failed to import module %s: %s", module_info.name, exc)
    return modules


def _extract_router(module: Any) -> Optional[APIRouter]:
    """
    Try to extract APIRouter instance from module.
    Supported attribute names: router, api_router.
    """
    for attr_name in ("router", "api_router"):
        router = getattr(module, attr_name, None)
        if isinstance(router, APIRouter):
            return router
    return None


def _include_all_routers(app: FastAPI) -> None:
    """
    Automatically include all APIRouter instances from app.* and app.api.* modules.
    """
    logger.info("Including routers from app.* and app.api.*")

    for package_name in ("app", "app.api"):
        for module in _iter_modules(package_name):
            router = _extract_router(module)
            if router is not None:
                logger.info(
                    "Including router from module %s with prefix %s",
                    getattr(module, "__name__", "<unknown>"),
                    "".join(getattr(router, "prefix", "") or ""),
                )
                app.include_router(router)


app = create_app()
