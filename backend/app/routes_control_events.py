from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Query

from . import control_events_service


router = APIRouter(
    prefix="/api",
    tags=["control-events"],
)


@router.get("/control-events/{client_id}")
async def api_get_control_events(
    client_id: str,
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
) -> Dict[str, Any]:
    """
    Simple proxy around control_events_service.get_control_events_for_client.
    """
    return control_events_service.get_control_events_for_client(
        client_id=client_id,
        year=year,
        month=month,
    )


@router.post("/control-events/{client_id}/generate-tasks")
async def api_generate_tasks_from_control_events(
    client_id: str,
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
) -> Dict[str, Any]:
    """
    Safe wrapper around control_events_service.generate_tasks_for_client.

    This endpoint MUST NOT raise, so that frontend never gets HTTP 500 from here.
    On any internal error it returns a payload with zero tasks and an error field.
    """
    try:
        result = control_events_service.generate_tasks_for_client(
            client_id=client_id,
            year=year,
            month=month,
        )
        if not isinstance(result, dict):
            return {
                "client_id": client_id,
                "tasks_suggested": 0,
                "tasks": [],
                "error": "invalid_result_type",
            }
        if "client_id" not in result:
            result["client_id"] = client_id
        if "tasks_suggested" not in result:
            tasks = result.get("tasks") or []
            result["tasks_suggested"] = len(tasks)
        if "tasks" not in result:
            result["tasks"] = []
        return result
    except Exception as exc:
        return {
            "client_id": client_id,
            "tasks_suggested": 0,
            "tasks": [],
            "error": f"generate_tasks_failed: {exc.__class__.__name__}",
        }
