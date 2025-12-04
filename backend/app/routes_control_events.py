from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from .control_event_models import (
    ControlEventsResponse,
    ErrorResponse,
    GenerateTasksResponse,
)
from .control_events_service import (
    generate_tasks_for_client,
    get_control_events_for_client,
)


router = APIRouter(
    prefix="/api",
    tags=["control-events"],
)


@router.get(
    "/control-events/{client_id}",
    response_model=ControlEventsResponse,
    responses={
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
def get_control_events(
    client_id: str,
    year: Optional[int] = Query(
        default=None,
        description="Optional year filter",
    ),
    month: Optional[int] = Query(
        default=None,
        description="Optional month filter, 1-12",
        ge=1,
        le=12,
    ),
) -> ControlEventsResponse:
    try:
        return get_control_events_for_client(
            client_id=client_id,
            year=year,
            month=month,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Internal error while fetching control events",
        ) from exc


@router.post(
    "/control-events/{client_id}/generate-tasks",
    response_model=GenerateTasksResponse,
    responses={
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
def generate_tasks(
    client_id: str,
    year: Optional[int] = Query(
        default=None,
        description="Optional year filter",
    ),
    month: Optional[int] = Query(
        default=None,
        description="Optional month filter, 1-12",
        ge=1,
        le=12,
    ),
) -> GenerateTasksResponse:
    try:
        now = datetime.utcnow()
        return generate_tasks_for_client(
            client_id=client_id,
            year=year,
            month=month,
            now=now,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Internal error while generating tasks from control events",
        ) from exc
