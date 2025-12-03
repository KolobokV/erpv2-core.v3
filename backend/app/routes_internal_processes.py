from fastapi import APIRouter, HTTPException

from .internal_processes_store import (
    get_internal_definitions,
    get_internal_instances,
    run_instance,
    generate_tasks_for_instance,
)

router = APIRouter(tags=["internal-processes"])


# --------------------------
# Definitions
# --------------------------

@router.get("/process-definitions")
def api_get_process_definitions():
    """
    Main endpoint used by smoke tests and frontend:
    GET /api/internal/process-definitions
    """
    return {"items": get_internal_definitions()}


@router.get("/definitions")
def api_get_definitions_alias():
    """
    Backward-compatible alias:
    GET /api/internal/definitions
    """
    return {"items": get_internal_definitions()}


# --------------------------
# Instances
# --------------------------

@router.get("/process-instances")
def api_get_process_instances():
    """
    Main endpoint for instances:
    GET /api/internal/process-instances
    """
    return {"items": get_internal_instances()}


@router.get("/instances")
def api_get_instances_alias():
    """
    Backward-compatible alias:
    GET /api/internal/instances
    """
    return {"items": get_internal_instances()}


@router.post("/process-instances/{instance_id}/run")
def api_run_instance(instance_id: str):
    result = run_instance(instance_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"result": result}


@router.post("/process-instances/{instance_id}/generate-tasks")
def api_generate_tasks(instance_id: str):
    tasks = generate_tasks_for_instance(instance_id)
    return {"tasks": tasks}


@router.get("/process-instances/{instance_id}/tasks")
def api_get_tasks_for_instance(instance_id: str):
    """
    Temporary stub endpoint for tasks of a process instance.

    Frontend calls:
      GET /api/internal/process-instances/{instance_id}/tasks

    Until we have a real link between tasks and instances,
    we always return an empty list instead of 404.
    """
    return {"items": []}
