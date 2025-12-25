from fastapi import APIRouter, HTTPException
from app.services.process_to_tasks import generate_tasks_from_process

router = APIRouter(prefix="/api/internal/process-to-tasks", tags=["internal"])


@router.post("/generate/{client_code}")
def api_generate_tasks(client_code: str, year: int, month: int):
    try:
        result = generate_tasks_from_process(client_code, year, month)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
