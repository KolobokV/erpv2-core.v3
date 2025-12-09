import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

TASKS_STORE_NAME = "tasks_store.json"

BASE_DIR = Path(__file__).resolve().parent.parent.parent
TASKS_PATH = BASE_DIR / TASKS_STORE_NAME

router = APIRouter(prefix="/api", tags=["tasks"])


def _load_tasks_store() -> Dict[str, Any]:
    """
    Load tasks store from JSON file.

    Supported formats:
      - {"tasks": [ ... ]}
      - [ ... ]  (will be wrapped into {"tasks": [...]})
    """
    if not TASKS_PATH.exists():
        return {"tasks": []}

    try:
        raw = TASKS_PATH.read_text(encoding="utf-8-sig")
    except Exception:
        raw = TASKS_PATH.read_text(encoding="utf-8")

    try:
        data = json.loads(raw)
    except Exception:
        return {"tasks": []}

    if isinstance(data, list):
        return {"tasks": data}
    if isinstance(data, dict) and isinstance(data.get("tasks"), list):
        return data

    return {"tasks": []}


def _save_tasks_store(store: Dict[str, Any]) -> None:
    TASKS_PATH.write_text(
        json.dumps(store, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


@router.get("/tasks")
def list_tasks() -> List[Dict[str, Any]]:
    """
    Return flat list of tasks for debug UI.
    """
    store = _load_tasks_store()
    return store.get("tasks", [])


@router.post("/tasks")
def create_task(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minimal task creation endpoint.
    """
    title = payload.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="Missing title")

    store = _load_tasks_store()
    tasks = store.get("tasks", [])

    task_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    new_task: Dict[str, Any] = {
        "id": task_id,
        "title": title,
        "status": payload.get("status", "new"),
        "client_code": payload.get("client_code"),
        "client_label": payload.get("client_label") or payload.get("client_code"),
        "priority": payload.get("priority", "normal"),
        "deadline": payload.get("deadline"),
        "created_at": now,
        "updated_at": now,
    }

    tasks.append(new_task)
    store["tasks"] = tasks
    _save_tasks_store(store)

    return new_task


@router.post("/tasks/{task_id}/status")
def update_task_status(task_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update task status.
    """
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing status")

    store = _load_tasks_store()
    tasks = store.get("tasks", [])

    for task in tasks:
        if task.get("id") == task_id:
            task["status"] = new_status
            task["updated_at"] = datetime.utcnow().isoformat() + "Z"
            _save_tasks_store(store)
            return task

    raise HTTPException(status_code=404, detail="Task not found")
