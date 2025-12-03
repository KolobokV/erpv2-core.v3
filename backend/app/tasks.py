import json
import os
from typing import List
from fastapi import APIRouter, HTTPException
from .models import TaskModel

router = APIRouter()

TASKS_FILE = "tasks.json"


# ---- Storage helpers ----

def load_tasks() -> List[TaskModel]:
    if not os.path.exists(TASKS_FILE):
        return []
    with open(TASKS_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return [TaskModel(**item) for item in raw]


def save_tasks(tasks: List[TaskModel]):
    with open(TASKS_FILE, "w", encoding="utf-8") as f:
        json.dump([t.dict() for t in tasks], f, ensure_ascii=False, indent=2)


# ---- API Endpoints ----

@router.get("/tasks", response_model=List[TaskModel])
def get_tasks():
    return load_tasks()


@router.get("/tasks/{task_id}", response_model=TaskModel)
def get_task(task_id: str):
    tasks = load_tasks()
    for t in tasks:
        if t.id == task_id:
            return t
    raise HTTPException(status_code=404, detail="Task not found")


@router.post("/tasks", response_model=TaskModel)
def create_task(task: TaskModel):
    tasks = load_tasks()
    tasks.append(task)
    save_tasks(tasks)
    return task


@router.put("/tasks/{task_id}", response_model=TaskModel)
def update_task(task_id: str, updated: TaskModel):
    tasks = load_tasks()
    for i, t in enumerate(tasks):
        if t.id == task_id:
            tasks[i] = updated
            save_tasks(tasks)
            return updated
    raise HTTPException(status_code=404, detail="Task not found")


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    tasks = load_tasks()
    new_tasks = [t for t in tasks if t.id != task_id]
    if len(new_tasks) == len(tasks):
        raise HTTPException(status_code=404, detail="Task not found")
    save_tasks(new_tasks)
    return {"status": "deleted"}
