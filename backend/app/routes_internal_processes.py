from fastapi import APIRouter, HTTPException

from .internal_processes_store import get_internal_instances, update_instance_status

router = APIRouter(prefix="/api/internal", tags=["internal-processes"])


@router.post("/process-instances/{instance_id}/lifecycle/sync-from-tasks")
def api_sync_instance_lifecycle_from_tasks(instance_id: str, payload: dict):
    """
    Called by frontend when derivedStatus for a process instance
    has been recalculated based on related tasks.

    Expected body:
      {
        "derived_status": "completed-by-tasks"
      }

    Rules:
      - if derived_status == "completed-by-tasks":
            instance.status is set to "completed"
      - other values are currently ignored and instance is returned as is
    """
    derived_status = payload.get("derived_status")
    if not derived_status:
        raise HTTPException(status_code=400, detail="derived_status is required")

    # Only one lifecycle rule for now:
    # "completed-by-tasks" -> "completed"
    if derived_status == "completed-by-tasks":
        updated = update_instance_status(instance_id, "completed")
        if "error" in updated:
            raise HTTPException(status_code=404, detail=updated["error"])
        return {"instance": updated}

    # For other derived statuses we do not change lifecycle yet.
    # Just return current instance if it exists.
    instances = get_internal_instances()
    for inst in instances:
        if inst.get("id") == instance_id:
            return {"instance": inst}

    raise HTTPException(status_code=404, detail="instance not found")
