import json
import os
from datetime import datetime
from typing import List, Dict, Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFINITIONS_PATH = os.path.join(BASE_DIR, "process_definitions.json")
INSTANCES_PATH = os.path.join(BASE_DIR, "process_instances.json")


# ------------------------------
# Utility functions
# ------------------------------

def _load_json(path: str):
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        # Remove UTF-8 BOM if present
        if text.startswith("\ufeff"):
            text = text.lstrip("\ufeff")
        if not text.strip():
            return []
        return json.loads(text)
    except Exception:
        return []


def _save_json(path: str, data: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ------------------------------
# Definitions
# ------------------------------

def get_internal_definitions() -> List[Dict[str, Any]]:
    """Return all process definitions."""
    return _load_json(DEFINITIONS_PATH)


# ------------------------------
# Instances
# ------------------------------

def get_internal_instances() -> List[Dict[str, Any]]:
    """Return all process instances."""
    return _load_json(INSTANCES_PATH)


def save_instances(instances: List[Dict[str, Any]]):
    _save_json(INSTANCES_PATH, instances)


def update_instance_status(instance_id: str, new_status: str) -> Dict[str, Any]:
    """
    Update status for a single process instance and persist it.

    This function is used by lifecycle sync from tasks:
      - for example, when derived_status == "completed-by-tasks"
        we set instance.status = "completed".
    """
    instances = get_internal_instances()

    for inst in instances:
        if inst.get("id") == instance_id:
            inst["status"] = new_status
            # keep existing created_at; just bump updated_at for traceability
            inst["updated_at"] = datetime.utcnow().isoformat()
            save_instances(instances)
            return inst

    return {"error": "instance not found"}


# ------------------------------
# Running instances
# ------------------------------

def run_instance(instance_id: str) -> Dict[str, Any]:
    instances = get_internal_instances()
    for inst in instances:
        if inst.get("id") == instance_id:
            inst["last_run"] = datetime.utcnow().isoformat()
            save_instances(instances)
            return inst

    return {"error": "instance not found"}


# ------------------------------
# Generate tasks for instance
# ------------------------------

def generate_tasks_for_instance(instance_id: str) -> List[Dict[str, Any]]:
    """
    Stub: generate tasks for the instance.
    The real logic is in process_engine, but store must expose a stable API.
    """
    instances = get_internal_instances()

    for inst in instances:
        if inst.get("id") == instance_id:
            tasks = [
                {
                    "task_id": f"{instance_id}-task-{i}",
                    "title": f"Auto task {i}",
                    "created_at": datetime.utcnow().isoformat(),
                }
                for i in range(1, 4)
            ]

            inst["generated_tasks"] = tasks
            save_instances(instances)
            return tasks

    return []


# ------------------------------
# Monthly scheduler helper
# ------------------------------

def create_monthly_instances_if_absent() -> Dict[str, Any]:
    """
    Called by scheduler.
    Creates an instance per definition if missing for current month.
    """
    definitions = get_internal_definitions()
    instances = get_internal_instances()

    year = datetime.utcnow().year
    month = datetime.utcnow().month
    stamp = f"{year}-{month}"

    created = []

    for d in definitions:
        def_id = d.get("id")
        exists = any(
            inst.get("definition_id") == def_id and inst.get("period") == stamp
            for inst in instances
        )

        if not exists:
            inst = {
                "id": f"{def_id}-{stamp}",
                "definition_id": def_id,
                "period": stamp,
                "created_at": datetime.utcnow().isoformat(),
                "generated_tasks": [],
            }
            instances.append(inst)
            created.append(inst)

    save_instances(instances)
    return {"created": created, "count": len(created)}
