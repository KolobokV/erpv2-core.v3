from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# NOTE:
# This main.py is intentionally defensive.
# ERPv2 backend has evolved with multiple route modules living either:
# - directly under the app package (app/routes_*.py)
# - or under a subpackage (app/api/routes_*.py)
# We load whatever exists and expose the expected endpoints.

app = FastAPI(title="ERPv2 API", version="v36.10")

# CORS (keep permissive for local dev)
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _try_include(module_path: str) -> bool:
    try:
        mod = __import__(module_path, fromlist=["router"])
        router = getattr(mod, "router", None)
        if router is None:
            return False
        app.include_router(router)
        return True
    except Exception:
        return False

def _include_candidates(name: str) -> None:
    # prefer app.<name>, then app.api.<name>
    _try_include(f"app.{name}")
    _try_include(f"app.api.{name}")

# ---- Core expected routes ----
for _mod in [
    # public
    "routes_tasks",
    "routes_clients",
    "routes_invoices",
    "routes_products",
    "routes_client_profiles",
    "routes_control_events",

    # internal
    "routes_internal",
    "routes_internal_tasks",
    "routes_internal_processes",
    "routes_internal_processes_v2",
    "routes_internal_chains",
    "routes_process_chains_dev",
    "routes_process_chains_v2",
    "routes_process_chains_reglement",
    "routes_process_instances",
    "routes_process_instances_v2",
    "routes_process_intents",
    "routes_process_overview",
    "routes_process_overview_zoom",
    "routes_process_to_tasks",
    "routes_internal_control_events",
    "routes_internal_control_events_store",
    "routes_internal_control_events_store_v2",
    "routes_internal_control_event_store",

    # onboarding
    "routes_onboarding_intake",
]:
    _include_candidates(_mod)

# ---- minimal health ----
@app.get("/api/health")
def health():
    return {"status": "ok"}
