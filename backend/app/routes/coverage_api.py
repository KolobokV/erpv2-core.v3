from fastapi import APIRouter
from app.services.coverage_service import calculate_coverage
from app.routes_internal_tasks import list_tasks_internal

router = APIRouter(prefix="/api/coverage", tags=["coverage"])

@router.get("/summary")
def coverage_summary(period: str):
    tasks = list_tasks_internal()
    return calculate_coverage(tasks, period)