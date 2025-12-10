from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/internal/tasks", tags=["internal-tasks"])

BASE_DIR = Path(__file__).resolve().parents[2]
TASKS_STORE_PATH = BASE_DIR / "tasks_store.json"


class TaskUpdate(BaseModel):
  status: Optional[str] = None
  priority: Optional[str] = None
  deadline: Optional[str] = None
  title: Optional[str] = None
  description: Optional[str] = None


def _load_tasks_store() -> tuple[List[Dict[str, Any]], Any, Optional[str]]:
  """
  Load tasks from tasks_store.json in a tolerant way.

  Returns:
      (tasks_list, container, key_name)
  """
  if not TASKS_STORE_PATH.exists():
    return [], [], None

  with TASKS_STORE_PATH.open("r", encoding="utf-8") as f:
    try:
      data = json.load(f)
    except Exception:
      return [], [], None

  if isinstance(data, list):
    tasks_list = [t for t in data if isinstance(t, dict)]
    return tasks_list, tasks_list, None

  if isinstance(data, dict):
    for key in ["tasks", "items"]:
      val = data.get(key)
      if isinstance(val, list):
        tasks_list = [t for t in val if isinstance(t, dict)]
        return tasks_list, data, key

  return [], data, None


def _save_tasks_store(
  tasks: List[Dict[str, Any]],
  container: Any,
  key_name: Optional[str],
) -> None:
  if isinstance(container, list):
    data_to_write = tasks
  elif isinstance(container, dict) and key_name:
    container[key_name] = tasks
    data_to_write = container
  else:
    data_to_write = tasks

  TASKS_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
  with TASKS_STORE_PATH.open("w", encoding="utf-8") as f:
    json.dump(data_to_write, f, ensure_ascii=False, indent=2)


def _find_task_by_id(tasks: List[Dict[str, Any]], task_id: str) -> Optional[Dict[str, Any]]:
  for t in tasks:
    tid = t.get("id")
    if tid is not None and str(tid) == str(task_id):
      return t
  return None


@router.get("/", summary="List all tasks (internal)")
def list_tasks_internal() -> List[Dict[str, Any]]:
  tasks, _, _ = _load_tasks_store()
  return tasks


@router.get("/{task_id}", summary="Get single task by id")
def get_task_internal(task_id: str) -> Dict[str, Any]:
  tasks, _, _ = _load_tasks_store()
  task = _find_task_by_id(tasks, task_id)
  if not task:
    raise HTTPException(status_code=404, detail="Task not found")
  return task


@router.post(
  "/{task_id}",
  summary="Update task fields (status, priority, deadline, title, description)",
)
def update_task_internal(task_id: str, payload: TaskUpdate) -> Dict[str, Any]:
  tasks, container, key_name = _load_tasks_store()
  if not tasks:
    raise HTTPException(status_code=404, detail="Tasks store is empty")

  task = _find_task_by_id(tasks, task_id)
  if not task:
    raise HTTPException(status_code=404, detail="Task not found")

  if payload.status is not None:
    task["status"] = payload.status
  if payload.priority is not None:
    task["priority"] = payload.priority
  if payload.deadline is not None:
    task["deadline"] = payload.deadline
  if payload.title is not None:
    task["title"] = payload.title
  if payload.description is not None:
    task["description"] = payload.description

  now_iso = datetime.utcnow().isoformat() + "Z"
  if "updated_at" in task:
    task["updated_at"] = now_iso

  _save_tasks_store(tasks, container, key_name)

  return {"status": "ok", "task": task}
