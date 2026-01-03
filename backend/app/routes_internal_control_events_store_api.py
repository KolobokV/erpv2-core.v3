from fastapi import APIRouter
from typing import Any, Dict, List

router = APIRouter(prefix="/api/internal", tags=["internal"])


def _payload() -> Dict[str, Any]:
    # Keep response stable and harmless if frontend expects arrays/objects.
    return {
        "items": [],
        "templates": [],
        "controlEvents": [],
        "meta": {"stub": True, "reason": "endpoint_not_implemented"},
    }


@router.get("/control-events-store")
@router.get("/control-events-store/")
@router.get("/control-events-store-v2")
@router.get("/control-events-store-v2/")
def get_control_events_store() -> Dict[str, Any]:
    return _payload()
