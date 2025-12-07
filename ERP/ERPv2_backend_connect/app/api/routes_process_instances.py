from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.process_instances_service import (
    get_process_instance,
    list_process_instances,
    list_process_instances_for_client,
    add_step,
    complete_step,
)


class StepCreate(BaseModel):
    title: str


router = APIRouter(
    prefix="/api/internal/process-instances",
    tags=["process-instances"],
)


@router.get("/")
def list_instances():
    items = list_process_instances()
    return {"count": len(items), "items": items}


@router.get("/by-client/{client_id}")
def list_instances_for_client_endpoint(
    client_id: str,
    period: Optional[str] = Query(default=None),
):
    items = list_process_instances_for_client(client_id, period)
    return {"client_id": client_id, "period": period, "count": len(items), "items": items}


@router.get("/{instance_id}")
def instance_details(instance_id: str):
    try:
        return get_process_instance(instance_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# --------------------------
# E2.5 — STEPS API
# --------------------------

@router.post("/{instance_id}/steps")
def add_step_endpoint(instance_id: str, body: StepCreate):
    try:
        st = add_step(instance_id, body.title)
        return {"created": True, "step": st}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{instance_id}/steps/{step_id}/complete")
def complete_step_endpoint(instance_id: str, step_id: str):
    try:
        st = complete_step(instance_id, step_id)
        return {"completed": True, "step": st}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
