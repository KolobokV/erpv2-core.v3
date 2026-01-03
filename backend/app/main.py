from fastapi import FastAPI
from app.routes_internal_control_events_store_stub import router as control_events_store_stub_router
from app.routes_internal_control_events_store_api import router as control_events_store_router
from fastapi.middleware.cors import CORSMiddleware

# === INTERNAL TASKS ===
from app.routes_internal_tasks import router as tasks_router

# === CLIENT PROFILES ===
from app.routes_client_profiles import router as client_profiles_router

# === PROCESS INSTANCES V2 ===
from app.routes_process_instances_v2 import router as process_instances_v2_router

# === OTHER ROUTERS ===
from app.routes_internal_process_chains_dev import router as dev_chains_router
from app.routes_control_events_api import router as control_events_router
from app.routes_onboarding_api import router as onboarding_router

# === ANALYTICS ===
from app.routes.risk_api import router as risk_router
from app.routes.coverage_api import router as coverage_router

app = FastAPI(title="ERPv2 API")

app.include_router(control_events_store_router)
app.include_router(control_events_store_stub_router)

# === CORS (DEV SAFE) ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- internal core ---
app.include_router(tasks_router)
app.include_router(control_events_store_stub_router)
app.include_router(client_profiles_router)
app.include_router(control_events_store_stub_router)
app.include_router(process_instances_v2_router)
app.include_router(control_events_store_stub_router)

# --- system ---
app.include_router(control_events_router)
app.include_router(control_events_store_stub_router)
app.include_router(onboarding_router)
app.include_router(control_events_store_stub_router)
app.include_router(dev_chains_router)
app.include_router(control_events_store_stub_router)

# --- analytics ---
app.include_router(risk_router)
app.include_router(control_events_store_stub_router)
app.include_router(coverage_router)