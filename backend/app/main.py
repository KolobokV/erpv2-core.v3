from __future__ import annotations

import importlib
import logging
import pkgutil
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.startup_events import register_startup_events, register_shutdown_events

logger = logging.getLogger("erpv2.app.main")


def create_app() -> FastAPI:
  app = FastAPI(
    title="ERPv2 Backend",
    version="0.1.0",
  )

  # CORS for local frontend (Vite on 5174)
  origins = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://10.132.65.236:5174",
    "http://192.168.1.135:5174",
  ]

  app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
  )

  # Include all routers from app and app.api packages automatically.
  _include_all_routers(app)

  # Register startup / shutdown events.
  register_startup_events(app)
  register_shutdown_events(app)

  @app.get("/api/health", tags=["system"])
  def health() -> dict[str, Any]:
    return {"status": "ok"}

  return app


def _include_all_routers(app: FastAPI) -> None:
  """
  Auto-discover and include all FastAPI routers from app/* and app/api/*.

  Any module that defines a top-level variable named `router`
  will be imported and included.
  """
  import app as app_pkg  # type: ignore
  import app.api as api_pkg  # type: ignore

  packages = [app_pkg, api_pkg]

  for pkg in packages:
    for module_info in pkgutil.walk_packages(pkg.__path__, pkg.__name__ + "."):
      module_name = module_info.name

      try:
        module = importlib.import_module(module_name)
      except Exception as exc:
        logger.warning(
          "Failed to import module %s: %s",
          module_name,
          exc,
        )
        continue

      router = getattr(module, "router", None)
      if router is not None:
        try:
          app.include_router(router)  # type: ignore[arg-type]
          logger.info("Included router from module %s", module_name)
        except Exception as exc:
          logger.warning(
            "Failed to include router from module %s: %s",
            module_name,
            exc,
          )


app = create_app()
