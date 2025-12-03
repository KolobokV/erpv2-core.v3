from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes_clients import router as clients_router
from .routes_invoices import router as invoices_router
from .routes_products import router as products_router
from .routes_internal_processes import router as internal_processes_router
from .routes_internal_scheduler import router as scheduler_router
from .routes_client_profiles import router as client_profiles_router
from .routes_tasks_dashboard import router as tasks_dashboard_router
from .routes_control_events import router as control_events_router

from .tasks import router as tasks_router

app = FastAPI(title="ERPv2 Backend", version="3.0")


# ============================================================
# CORS (for dev on ports 5173 / 5174)
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HEALTH ENDPOINT
# ============================================================

@app.get("/api/health")
def api_health():
    return {
        "status": "ok",
        "time": datetime.utcnow().isoformat(),
    }


# ============================================================
# BASE API: CONFIG
# ============================================================

@app.get("/api/config")
def api_config():
    return {
        "status": "ok",
        "frontend_prod_port": 5173,
        "frontend_dev_port": 5174,
        "backend_port": 8000,
    }


# ============================================================
# ROUTERS
# ============================================================

# Public API under /api
app.include_router(tasks_router,           prefix="/api")
app.include_router(tasks_dashboard_router, prefix="/api")
app.include_router(clients_router,         prefix="/api")
app.include_router(invoices_router,        prefix="/api")
app.include_router(products_router,        prefix="/api")

# Control events
app.include_router(control_events_router, prefix="/api")

# Internal API under /api/internal
app.include_router(client_profiles_router,    prefix="/api/internal")
app.include_router(internal_processes_router, prefix="/api/internal")
app.include_router(scheduler_router,          prefix="/api/internal")


# ============================================================
# ROOT (optional)
# ============================================================

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "ERPv2 backend is running",
        "time": datetime.utcnow().isoformat(),
    }
