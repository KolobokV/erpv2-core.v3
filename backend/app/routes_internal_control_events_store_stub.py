from fastapi import APIRouter

router = APIRouter(tags=["internal", "control-events-store"])

@router.get("/api/internal/control-events-store/")
def get_control_events_store_legacy():
    return {"items": []}

@router.get("/api/internal/control-events-store-v2/")
def get_control_events_store_v2():
    return {"items": []}
