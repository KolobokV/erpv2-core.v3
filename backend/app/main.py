import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_tasks import router as router_tasks
from app.api.routes_client_profiles import router as router_client_profiles
from app.api.routes_control_events import router as router_control_events
from app.api.routes_internal_control_events import router as router_internal_control_events
from app.api.routes_internal_control_events_store import router as router_internal_control_events_store

from app.api.routes_process_instances_v2 import router as router_process_instances_v2
from app.api.routes_process_chains_dev import router as router_process_chains_dev
from app.api.routes_process_overview import router as router_process_overview
from app.api.routes_process_overview_zoom import router as router_process_overview_zoom

# NEW
from app.api.routes_process_to_tasks import router as router_process_to_tasks

from app.startup_events import register_startup_events, register_shutdown_events


def create_app():
    app = FastAPI(title="ERPv2 backend")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # routers
    app.include_router(router_tasks)
    app.include_router(router_client_profiles)
    app.include_router(router_control_events)
    app.include_router(router_internal_control_events)
    app.include_router(router_internal_control_events_store)

    app.include_router(router_process_instances_v2)
    app.include_router(router_process_chains_dev)
    app.include_router(router_process_overview)
    app.include_router(router_process_overview_zoom)

    # NEW
    app.include_router(router_process_to_tasks)

    register_startup_events(app)
    register_shutdown_events(app)

    return app


app = create_app()
