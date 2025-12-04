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


@router.post("/{client_id}/generate-tasks")
async def generate_tasks_from_control_events(client_id: str):
    """
    Build task payloads from control events for given client.

    This endpoint does not persist tasks. It returns a list of
    payloads compatible with TaskModel which can be sent to /api/tasks.
    """
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id is required",
        )

    tasks = control_events_service.build_task_payloads_for_client(
        client_id=client_id
    )

    return {
        "client_id": client_id,
        "tasks_suggested": len(tasks),
        "tasks": tasks,
    }
