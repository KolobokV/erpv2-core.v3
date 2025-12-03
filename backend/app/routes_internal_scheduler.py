from fastapi import APIRouter
from .scheduler import run_monthly_scheduler

router = APIRouter(prefix="/scheduler", tags=["internal-scheduler"])


@router.post("/run-monthly")
def api_run_monthly():
    """
    Trigger monthly scheduler:
    POST /api/internal/scheduler/run-monthly
    """
    return run_monthly_scheduler()
