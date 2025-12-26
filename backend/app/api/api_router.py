from fastapi import APIRouter

api_router = APIRouter(prefix="/api")

def safe_include(router, prefix: str):
    try:
        api_router.include_router(router, prefix=prefix)
    except Exception as e:
        print(f"[WARN] router {prefix} not loaded: {e}")

from app.api.routers.health import router as health_router
from app.api.routers.clients import router as clients_router
from app.api.routers.tasks import router as tasks_router
from app.api.routers.processes import router as processes_router
from app.api.routers.control_events import router as control_events_router

safe_include(health_router, "")
safe_include(clients_router, "/clients")
safe_include(tasks_router, "/tasks")
safe_include(processes_router, "/processes")
safe_include(control_events_router, "/control-events")