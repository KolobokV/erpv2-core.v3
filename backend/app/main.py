from __future__ import annotations

import logging
import pkgutil
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

from app.startup_events import init_app_events


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")


def discover_api_routers() -> List[APIRouter]:
    """
    Discover APIRouter instances in common app packages.

    We look for attributes named `api_router` or `router`
    inside modules under:
      - app.*
      - app.api.*
      - app.routes.*
      - app.routers.*
    """
    routers: List[APIRouter] = []

    base_packages = ["app", "app.api", "app.routes", "app.routers"]

    seen_ids = set()

    for base_name in base_packages:
        try:
            base_module = __import__(base_name, fromlist=["__path__"])
        except ImportError:
            continue
        except Exception:
            logger.exception("Error importing base package %s", base_name)
            continue

        module_path = getattr(base_module, "__path__", None)
        if module_path is None:
            # Not a package with a __path__, skip
            continue

        prefix = base_module.__name__ + "."

        for finder, name, ispkg in pkgutil.walk_packages(module_path, prefix):
            try:
                module = __import__(name, fromlist=["api_router", "router"])
            except ImportError:
                continue
            except Exception:
                logger.exception("Error importing module %s", name)
                continue

            for attr_name in ("api_router", "router"):
                candidate = getattr(module, attr_name, None)
                if isinstance(candidate, APIRouter):
                    cid = id(candidate)
                    if cid not in seen_ids:
                        seen_ids.add(cid)
                        routers.append(candidate)
                        logger.info(
                            "Discovered %s in module %s as attribute %s",
                            candidate,
                            name,
                            attr_name,
                        )

    if not routers:
        logger.warning("No APIRouter instances discovered")
    else:
        logger.info("Total discovered APIRouter instances: %d", len(routers))

    return routers


def create_app() -> FastAPI:
    app = FastAPI(
        title="ERPv2 Backend",
        version="1.0.0",
    )

    # CORS config
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Discover and include all routers
    for router in discover_api_routers():
        app.include_router(router)

    # Simple health endpoint so the app is never completely empty
    @app.get("/health", tags=["health"])
    async def health_check() -> dict:
        return {"status": "ok"}

    # Startup events
    @app.on_event("startup")
    async def on_startup() -> None:
        await init_app_events(app)
        logger.info("Application startup complete")

    return app


app = create_app()
