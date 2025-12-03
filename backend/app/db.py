import json
from pathlib import Path
from typing import List
from .models import (
    ClientProfile,
    ProcessDefinition,
    ProcessInstance,
    TaskModel,
)


BASE_DIR = Path(__file__).resolve().parent.parent / "data"
BASE_DIR.mkdir(exist_ok=True, parents=True)

# ---- FILE PATHS ----
CLIENT_PROFILES_FILE = BASE_DIR / "client_profiles.json"
PROCESS_DEFINITIONS_FILE = BASE_DIR / "process_definitions.json"
PROCESS_INSTANCES_FILE = BASE_DIR / "process_instances.json"
TASKS_FILE = BASE_DIR / "tasks.json"


# ---- UNIVERSAL JSON HELPERS ----

def _load_json(path: Path):
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: Path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ---- CLIENT PROFILES ----

def load_client_profiles() -> List[ClientProfile]:
    raw = _load_json(CLIENT_PROFILES_FILE)
    return [ClientProfile(**item) for item in raw]


def save_client_profiles(profiles: List[ClientProfile]):
    raw = [p.model_dump() for p in profiles]
    _save_json(CLIENT_PROFILES_FILE, raw)


# ---- PROCESS DEFINITIONS ----

def load_process_definitions() -> List[ProcessDefinition]:
    raw = _load_json(PROCESS_DEFINITIONS_FILE)
    return [ProcessDefinition(**item) for item in raw]


def save_process_definitions(defs: List[ProcessDefinition]):
    raw = [d.model_dump() for d in defs]
    _save_json(PROCESS_DEFINITIONS_FILE, raw)


# ---- PROCESS INSTANCES ----

def load_process_instances() -> List[ProcessInstance]:
    raw = _load_json(PROCESS_INSTANCES_FILE)
    return [ProcessInstance(**item) for item in raw]


def save_process_instances(instances: List[ProcessInstance]):
    raw = [i.model_dump() for i in instances]
    _save_json(PROCESS_INSTANCES_FILE, raw)


# ---- TASKS ----

def load_tasks() -> List[TaskModel]:
    raw = _load_json(TASKS_FILE)
    return [TaskModel(**item) for item in raw]


def save_tasks(tasks: List[TaskModel]):
    raw = [t.model_dump() for t in tasks]
    _save_json(TASKS_FILE, raw)
