from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.events import EventTypes, get_event_system


router = APIRouter(
    prefix="/api/internal/chains",
    tags=["internal-chains"],
)


class DebugChainTrigger(BaseModel):
    chain_id: str
    client_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


@router.post("/debug-trigger")
async def debug_trigger(payload: DebugChainTrigger) -> Dict[str, Any]:
    """
    Debug endpoint to trigger chains via the event system.

    It does not touch the database and is safe to call manually.
    """
    events = get_event_system()

    await events.publish(
        EventTypes.CHAIN_TRIGGERED,
        {
            "chain_id": payload.chain_id,
            "client_id": payload.client_id,
            "context": payload.context or {},
        },
    )

    return {
        "status": "ok",
        "chain_id": payload.chain_id,
        "client_id": payload.client_id,
    }
