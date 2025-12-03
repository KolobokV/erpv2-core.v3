from fastapi import APIRouter

router = APIRouter(prefix="/process-instances", tags=["internal-processes-tasks-stub"])


@router.get("/{instance_id}/tasks")
def get_tasks_for_instance(instance_id: str):
    """
    Stub endpoint for tasks of a process instance.

    Frontend calls:
      GET /api/internal/process-instances/{instance_id}/tasks

    Until we have a real link between tasks and instances,
    we always return an empty list instead of 404.
    """
    return {"items": []}
