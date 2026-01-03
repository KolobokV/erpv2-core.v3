from fastapi import APIRouter
from app.services.risk_service import calculate_risks
from app.routes_internal_tasks import list_tasks_internal

router = APIRouter(prefix="/api/risk", tags=["risk"])

@router.get("/summary")
def risk_summary():
    tasks = list_tasks_internal()
    return calculate_risks(tasks)