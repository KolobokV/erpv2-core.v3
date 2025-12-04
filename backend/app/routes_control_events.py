from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from .control_events_service import control_events_service

router = APIRouter(prefix="/control-events", tags=["control-events"])


@router.get("/{client_id}")
async def get_control_events_for_client(client_id: str):
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id is required",
        )

    events = control_events_service.get_events_for_client(client_id=client_id)
    return {"client_id": client_id, "events": events}
