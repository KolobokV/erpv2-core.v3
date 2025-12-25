import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any

from app.core.store_json import load_json_store, save_json_store

INSTANCES_PATH = "process_instances_store.json"
TASKS_PATH = "tasks_store.json"


def load_instances() -> Dict[str, Any]:
    try:
        return load_json_store(INSTANCES_PATH)
    except Exception as e:
        logging.error(f"load_instances error: {e}")
        return {"instances": []}


def load_tasks() -> Dict[str, Any]:
    try:
        return load_json_store(TASKS_PATH)
    except Exception:
        return {"tasks": []}


def save_tasks(data: Dict[str, Any]):
    save_json_store(TASKS_PATH, data)


def generate_tasks_from_process(client_code: str, year: int, month: int) -> Dict[str, Any]:
    instances = load_instances().get("instances", [])
    period_key = f"{year:04d}-{month:02d}"

    matched = [
        inst for inst in instances
        if inst.get("client_code") == client_code and inst.get("period") == period_key
    ]

    if not matched:
        return {"created": 0, "period": period_key, "client": client_code}

    steps: List[Dict[str, Any]] = matched[0].get("steps", [])
    tasks_store = load_tasks()
    tasks = tasks_store.get("tasks", [])

    created_count = 0

    for step in steps:
        title = step.get("title", "Untitled step")
        event_date_str = step.get("event_date")
        try:
            due_date = event_date_str if event_date_str else f"{period_key}-28"
        except Exception:
            due_date = f"{period_key}-28"

        new_task = {
            "id": str(uuid.uuid4()),
            "client_code": client_code,
            "title": title,
            "due_date": due_date,
            "status": "new",
            "created_at": datetime.utcnow().isoformat()
        }

        tasks.append(new_task)
        created_count += 1

    tasks_store["tasks"] = tasks
    save_tasks(tasks_store)

    return {
        "client": client_code,
        "period": period_key,
        "created": created_count
    }
