from datetime import date, timedelta, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api", tags=["tasks"])

# Very simple in-memory storage for demo purposes.
TASKS: List[Dict[str, Any]] = []


def _ensure_seed_tasks() -> None:
    """Seed some demo tasks if storage is empty."""
    if TASKS:
        return

    today = date.today()
    TASKS.extend(
        [
            {
                "id": "task_demo_01",
                "title": "Collect bank statements for demo client",
                "description": "Collect monthly bank statements for demo client.",
                "status": "planned",
                "client_id": "client_demo_01",
                "due_date": today.isoformat(),
            },
            {
                "id": "task_demo_02",
                "title": "Prepare tax report for demo client",
                "description": "Prepare simplified tax report.",
                "status": "in_progress",
                "client_id": "client_demo_01",
                "due_date": (today + timedelta(days=5)).isoformat(),
            },
            {
                "id": "task_demo_03",
                "title": "Upload primary documents",
                "description": "Upload primary documents to ERP.",
                "status": "planned",
                "client_id": "ip_usn_dr",
                "due_date": (today + timedelta(days=3)).isoformat(),
            },
        ]
    )


def _find_task_index(task_id: str) -> Optional[int]:
    for idx, t in enumerate(TASKS):
        if str(t.get("id")) == task_id:
            return idx
    return None


@router.get("/tasks")
async def list_tasks() -> List[Dict[str, Any]]:
    """
    Return all tasks from in-memory storage.
    Frontend expects plain array or object with items; array is fine.
    """
    _ensure_seed_tasks()
    return TASKS


@router.post("/tasks")
async def create_tasks(request: Request) -> Dict[str, Any]:
    """
    Create new tasks.
    Accepts single task object or list of task objects.
    Returns summary and created items.
    """
    payload = await request.json()

    created: List[Dict[str, Any]] = []

    def normalize_task(raw: Dict[str, Any]) -> Dict[str, Any]:
        task = dict(raw)
        if "id" not in task or not task["id"]:
            task["id"] = f"task_{len(TASKS) + len(created) + 1}"
        if "status" not in task or not task["status"]:
            task["status"] = "planned"
        # Normalize dates if present
        due_raw = task.get("due_date") or task.get("dueDate") or task.get("deadline")
        if due_raw:
            try:
                d = datetime.fromisoformat(str(due_raw)).date()
                task["due_date"] = d.isoformat()
            except Exception:
                # leave as is if cannot parse
                task["due_date"] = str(due_raw)
        return task

    if isinstance(payload, list):
        for item in payload:
            if not isinstance(item, dict):
                continue
            t = normalize_task(item)
            created.append(t)
            TASKS.append(t)
    elif isinstance(payload, dict):
        t = normalize_task(payload)
        created.append(t)
        TASKS.append(t)

    return {
        "status": "ok",
        "created": len(created),
        "items": created,
    }


@router.post("/tasks/{task_id}/start")
async def start_task(task_id: str) -> Dict[str, Any]:
    _ensure_seed_tasks()
    idx = _find_task_index(task_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    TASKS[idx]["status"] = "in_progress"
    return {"status": "ok", "task": TASKS[idx]}


@router.post("/tasks/{task_id}/mark-done")
async def mark_done(task_id: str) -> Dict[str, Any]:
    _ensure_seed_tasks()
    idx = _find_task_index(task_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    TASKS[idx]["status"] = "done"
    TASKS[idx]["completed_at"] = datetime.utcnow().isoformat()
    return {"status": "ok", "task": TASKS[idx]}


@router.post("/tasks/{task_id}/postpone")
async def postpone(task_id: str, request: Request) -> Dict[str, Any]:
    _ensure_seed_tasks()
    idx = _find_task_index(task_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Task not found")

    body = await request.json()
    days_raw = body.get("days", 1)
    try:
        days = int(days_raw)
    except Exception:
        days = 1

    due_raw = TASKS[idx].get("due_date")
    if due_raw:
        try:
            d = datetime.fromisoformat(str(due_raw)).date()
        except Exception:
            d = date.today()
    else:
        d = date.today()

    new_due = d + timedelta(days=days)
    TASKS[idx]["due_date"] = new_due.isoformat()

    return {"status": "ok", "task": TASKS[idx]}
