import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["tasks"])

STORE = Path(__file__).resolve().parent.parent.parent / "tasks_store.json"

def load_store():
    if not STORE.exists():
        return {"tasks": []}
    try:
        raw = STORE.read_text(encoding="utf-8")
        data = json.loads(raw)
        if isinstance(data, list):
            return {"tasks": data}
        if isinstance(data, dict) and isinstance(data.get("tasks"), list):
            return data
        return {"tasks": []}
    except:
        return {"tasks": []}

def save_store(store):
    STORE.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")

@router.get("/tasks")
def list_tasks():
    return load_store().get("tasks", [])

@router.post("/tasks")
def create_task(payload: Dict[str, Any]):
    title = payload.get("title")
    if not title:
        raise HTTPException(400,"Missing title")
    store = load_store()
    tasks = store["tasks"]

    now = datetime.utcnow().isoformat()+"Z"
    t = {
        "id": str(uuid.uuid4()),
        "title": title,
        "status": payload.get("status","new"),
        "client_code": payload.get("client_code"),
        "client_label": payload.get("client_label") or payload.get("client_code"),
        "priority": payload.get("priority","normal"),
        "deadline": payload.get("deadline"),
        "description": payload.get("description"),
        "created_at": now,
        "updated_at": now
    }

    tasks.append(t)
    save_store(store)
    return t

@router.post("/tasks/{task_id}/status")
def update_status(task_id: str, payload: Dict[str,Any]):
    status = payload.get("status")
    if not status:
        raise HTTPException(400, "Missing status")

    store = load_store()
    tasks = store["tasks"]

    for t in tasks:
        if t["id"] == task_id:
            t["status"] = status
            t["updated_at"] = datetime.utcnow().isoformat()+"Z"
            save_store(store)
            return t

    raise HTTPException(404,"Task not found")

@router.patch("/tasks/{task_id}")
def patch_task(task_id: str, payload: Dict[str,Any]):
    store = load_store()
    tasks = store["tasks"]

    for t in tasks:
        if t["id"] == task_id:
            for k,v in payload.items():
                if k!="id":
                    t[k]=v
            t["updated_at"] = datetime.utcnow().isoformat()+"Z"
            save_store(store)
            return t

    raise HTTPException(404,"Task not found")