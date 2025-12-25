from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.services import process_instances_service

router = APIRouter(
    prefix="/api/internal/process-instances",
    tags=["internal-process-instances"],
)


@router.get("/", summary="List process instances")
def list_process_instances(
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
    Return all process instances from the JSON store.

    If client_id is provided, only instances for this client are returned.
    If both client_id and period are provided, instances are filtered by
    client and exact period (YYYY-MM).
    """
    if client_id:
        return process_instances_service.list_process_instances_for_client(
            client_id=client_id,
            period=period,
        )
    return process_instances_service.list_process_instances()


@router.get(
    "/{instance_id}",
    summary="Get single process instance by id",
)
def get_process_instance(instance_id: str) -> Dict[str, Any]:
    """
    Return a single process instance by its id.

    The instance is annotated with computed_status derived from its steps.
    """
    instance = process_instances_service.get_process_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Process instance not found")
    return instance
