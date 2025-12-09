from fastapi import APIRouter
from app.core.store_json import load_json_store

CONTROL_EVENTS_TEMPLATES_STORE = "control_events_templates_store.json"

router = APIRouter(
    prefix="/api/internal/control-events-store",
    tags=["internal.control_events_store"]
)

@router.get("/")
def list_templates():
    data = load_json_store(CONTROL_EVENTS_TEMPLATES_STORE, default={"templates": []})
    return data.get("templates", [])
