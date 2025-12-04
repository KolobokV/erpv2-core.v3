from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes_tasks import router as tasks_router
from .routes_internal import router as internal_router
from .routes_control_events import router as control_events_router

app = FastAPI(title="ERPv2 backend (demo)")

# CORS for local frontend and any dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def api_health():
    return {"status": "ok", "service": "erpv2-backend-demo"}


@app.get("/api/config")
async def api_config():
    return {
        "name": "erpv2-backend-demo",
        "version": "dev-local",
        "features": {
            "tasks_in_memory": True,
            "internal_processes_in_memory": True,
            "control_events_enabled": True,
        },
    }


# Routers
app.include_router(tasks_router)
app.include_router(internal_router)
app.include_router(control_events_router)
