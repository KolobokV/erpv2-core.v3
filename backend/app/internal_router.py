from __future__ import annotations

from fastapi import APIRouter

internal_router = APIRouter()

from app.routes_internal import router as internal_core_router
internal_router.include_router(internal_core_router)

from app.routes_internal_tasks import router as internal_tasks_router
internal_router.include_router(internal_tasks_router)

from app.routes_internal_aliases_v2 import router as internal_aliases_v2_router
internal_router.include_router(internal_aliases_v2_router)

# Public compat endpoints that frontend still calls
from app.routes_control_events_api import router as control_events_router
internal_router.include_router(control_events_router)

from app.routes_onboarding_api import router as onboarding_router
internal_router.include_router(onboarding_router)

from app.routes_internal_process_chains_dev import router as internal_process_chains_dev_router
internal_router.include_router(internal_process_chains_dev_router)
