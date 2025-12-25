"""ERPv2 API root router.

This module must export `api_router` so `from app.api import api_router` works.
"""

from fastapi import APIRouter

api_router = APIRouter()

# --- Import and mount all known routers (avoid guessing at runtime) ---

from app.api.routes_tasks import router as tasks_router
from app.api.routes_client_profiles import router as client_profiles_router
from app.api.routes_process_instances import router as process_instances_router
from app.api.routes_process_instances_v2 import router as process_instances_v2_router
from app.api.routes_control_events import router as control_events_router

from app.api.routes_internal_tasks import router as internal_tasks_router
from app.api.routes_internal_processes_v2 import router as internal_processes_v2_router
from app.api.routes_internal_control_events import router as internal_control_events_router
from app.api.routes_internal_control_event_store import router as internal_control_event_store_router
from app.api.routes_internal_control_events_store import router as internal_control_events_store_router
from app.api.routes_internal_control_events_store_v2 import router as internal_control_events_store_v2_router
from app.api.routes_internal_chains import router as internal_chains_router

from app.api.routes_process_chains_dev import router as process_chains_dev_router
from app.api.routes_process_chains_reglement import router as process_chains_reglement_router
from app.api.routes_process_chains_v2 import router as process_chains_v2_router

from app.api.routes_process_overview import router as process_overview_router
from app.api.routes_process_overview_zoom import router as process_overview_zoom_router
from app.api.routes_process_to_tasks import router as process_to_tasks_router
from app.api.routes_process_intents import router as process_intents_router

from app.api.routes_onboarding_intake import router as onboarding_intake_router

from app.api.internal.chain_registry_api import router as chain_registry_router
from app.api.internal.chains_debug import router as chains_debug_router


api_router.include_router(tasks_router)
api_router.include_router(client_profiles_router)
api_router.include_router(process_instances_router)
api_router.include_router(process_instances_v2_router)
api_router.include_router(control_events_router)

api_router.include_router(internal_tasks_router)
api_router.include_router(internal_processes_v2_router)
api_router.include_router(internal_control_events_router)
api_router.include_router(internal_control_event_store_router)
api_router.include_router(internal_control_events_store_router)
api_router.include_router(internal_control_events_store_v2_router)
api_router.include_router(internal_chains_router)

api_router.include_router(process_chains_dev_router)
api_router.include_router(process_chains_reglement_router)
api_router.include_router(process_chains_v2_router)

api_router.include_router(process_overview_router)
api_router.include_router(process_overview_zoom_router)
api_router.include_router(process_to_tasks_router)
api_router.include_router(process_intents_router)

api_router.include_router(onboarding_intake_router)

api_router.include_router(chain_registry_router)
api_router.include_router(chains_debug_router)
