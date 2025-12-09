import uuid
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from app.core.store_json import load_json_store, save_json_store

TASKS_STORE = "tasks_store.json"

router = APIRouter(prefix="/api", tags=["tasks"])


def _load_tasks() -> Dict[str, Any]:
    data = load_json_store(TASKS_STORE, default={"tasks": []})
    if isinstance(data, dict) and isinstance(data.get("tasks"), list):
        return data
    return {"tasks": []}


def _save_tasks(data: Dict[str, Any]) -> None:
    save_json_store(TASKS_STORE, data)


@router.get("/tasks")
def list_tasks() -> List[Dict[str, Any]]:
    store = _load_tasks()
    return store.get("tasks", [])


@router.post("/tasks")
def create_task(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = payload.get("title")
    client_code = payload.get("client_code")

    if not title or not client_code:
        raise HTTPException(status_code=400, detail="Missing required fields")

    store = _load_tasks()
    tasks = store.get("tasks", [])

    new_task = {
        "id": str(uuid.uuid4()),
        "title": title,
        "client_code": client_code,
        "due_date": payload.get("due_date") or datetime.utcnow().date().isoformat(),
        "status": "new",
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    tasks.append(new_task)
    store["tasks"] = tasks
    _save_tasks(store)
    return new_task


@router.post("/tasks/{task_id}/status")
def update_task_status(task_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing status")

    store = _load_tasks()
    tasks = store.get("tasks", [])

    for t in tasks:
        if t.get("id") == task_id:
            t["status"] = new_status
            t["updated_at"] = datetime.utcnow().isoformat() + "Z"
            _save_tasks(store)
            return t

    raise HTTPException(status_code=404, detail="Task not found")
