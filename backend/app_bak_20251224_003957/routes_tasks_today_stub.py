from fastapi import APIRouter

router = APIRouter()


@router.get("/tasks/today")
def tasks_today_stub():
    """
    Stub endpoint for GET /api/tasks/today.
    Always returns empty list to avoid 404 on TasksBoard.
    """
    return {"items": []}
