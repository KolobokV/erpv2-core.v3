from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.process_instances_service import (
    list_process_instances as svc_list_instances,
    list_process_instances_for_client as svc_list_instances_for_client,
    get_process_instance as svc_get_process_instance,
)

router = APIRouter(
    prefix="/api/internal/process-instances-v2",
    tags=["internal-process-instances-v2"],
)


@router.get("/", summary="List process instances (v2)")
def list_process_instances_v2(
    client_id: Optional[str] = Query(
        default=None,
        description="Optional client_id to filter instances",
    ),
    period: Optional[str] = Query(
        default=None,
        description="Optional period filter in YYYY-MM format",
    ),
) -> List[Dict[str, Any]]:
    """
    Return process instances from the JSON store via process_instances_service.

    If client_id is provided, only instances for this client are returned.
    If both client_id and period are provided, instances are filtered by
    client and exact period (YYYY-MM).
    """
    if client_id:
        return svc_list_instances_for_client(
            client_id=client_id,
            period=period,
        )
    return svc_list_instances()


@router.get(
    "/{instance_id}",
    summary="Get single process instance by id (v2)",
)
def get_process_instance_v2(instance_id: str) -> Dict[str, Any]:
    """
    Return a single process instance by its id.

    The instance is annotated with computed_status derived from its steps.
    """
    instance = svc_get_process_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Process instance not found")
    return instance
