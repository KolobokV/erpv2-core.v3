from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/internal/tasks", tags=["internal-tasks"])

# Base dir = backend project root (ERPv2_backend_connect)
BASE_DIR = Path(__file__).resolve().parents[1]
TASKS_STORE_PATH = BASE_DIR / "tasks_store.json"


class TaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[str] = None  # ISO date string
    title: Optional[str] = None
    description: Optional[str] = None


def _utc_now_z() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _load_tasks_store() -> Tuple[List[Dict[str, Any]], Dict[str, Any], str]:
    if not TASKS_STORE_PATH.exists():
        TASKS_STORE_PATH.write_text(json.dumps({"items": []}, ensure_ascii=False, indent=2), encoding="utf-8")

    raw = TASKS_STORE_PATH.read_text(encoding="utf-8")
    try:
        data = json.loads(raw) if raw.strip() else {"items": []}
    except Exception:
        # If corrupted, do not crash the app: start fresh.
        data = {"items": []}

    if isinstance(data, list):
        return data, {"items": data}, "items"

    if isinstance(data, dict):
        if "items" in data and isinstance(data["items"], list):
            return data["items"], data, "items"
        if "tasks" in data and isinstance(data["tasks"], list):
            return data["tasks"], data, "tasks"

    # Unknown shape -> normalize
    container = {"items": []}
    return container["items"], container, "items"


def _save_tasks_store(container: Dict[str, Any], key: str, tasks: List[Dict[str, Any]]) -> None:
    container[key] = tasks
    TASKS_STORE_PATH.write_text(json.dumps(container, ensure_ascii=False, indent=2), encoding="utf-8")


def _find_task(tasks: List[Dict[str, Any]], task_id: str) -> Optional[Dict[str, Any]]:
    for t in tasks:
        if str(t.get("id")) == task_id:
            return t
    return None


def _discover_client_ids() -> List[str]:
    # Try to discover from any client profiles store file (names vary across versions).
    candidates = [
        BASE_DIR / "client_profiles_store.json",
        BASE_DIR / "client_profiles.json",
        BASE_DIR / "stores" / "client_profiles_store.json",
        BASE_DIR / "stores" / "client_profiles.json",
    ]

    for c in candidates:
        if c.exists():
            try:
                data = json.loads(c.read_text(encoding="utf-8"))
                items = data.get("items") if isinstance(data, dict) else None
                if isinstance(items, list):
                    ids = [str(x.get("id")) for x in items if isinstance(x, dict) and x.get("id")]
                    if ids:
                        return ids
            except Exception:
                pass

    # Fallback: known demo ids (stable in this project)
    return ["ip_usn_dr", "ooo_osno_3_zp1025", "ooo_usn_dr_tour_zp520"]


def _seed_demo_tasks_if_empty(tasks: List[Dict[str, Any]], container: Dict[str, Any], key: str) -> List[Dict[str, Any]]:
    if tasks:
        return tasks

    client_ids = _discover_client_ids()
    today = date.today()
    ym = f"{today.year:04d}-{today.month:02d}"
    now = _utc_now_z()

    seeded: List[Dict[str, Any]] = []
    for cid in client_ids:
        seeded.append(
            {
                "id": f"task-{cid}-bank-statement-{ym}-01",
                "client_id": cid,
                "title": "Bank statement import",
                "description": "Import and reconcile bank statement for the month.",
                "status": "open",
                "priority": "normal",
                "deadline": f"{ym}-05",
                "created_at": now,
                "updated_at": now,
            }
        )
        seeded.append(
            {
                "id": f"task-{cid}-tax-payment-{ym}-14",
                "client_id": cid,
                "title": "Tax payment",
                "description": "Prepare and schedule tax payment.",
                "status": "open",
                "priority": "high",
                "deadline": f"{ym}-14",
                "created_at": now,
                "updated_at": now,
            }
        )

    _save_tasks_store(container, key, seeded)
    return seeded


@router.get("", summary="List tasks (internal)")
@router.get("/", summary="List tasks (internal)")
def list_tasks_internal() -> List[Dict[str, Any]]:
    tasks, container, key = _load_tasks_store()
    tasks = _seed_demo_tasks_if_empty(tasks, container, key)
    return tasks


@router.get("/{task_id}", summary="Get task by id")
def get_task_internal(task_id: str) -> Dict[str, Any]:
    tasks, _, _ = _load_tasks_store()
    t = _find_task(tasks, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t


@router.post("/{task_id}", summary="Upsert task fields")
def upsert_task_internal(task_id: str, payload: TaskUpdate) -> Dict[str, Any]:
    tasks, container, key = _load_tasks_store()
    tasks = _seed_demo_tasks_if_empty(tasks, container, key)

    t = _find_task(tasks, task_id)
    now = _utc_now_z()

    if not t:
        t = {"id": task_id, "status": "open", "created_at": now, "updated_at": now}
        tasks.append(t)

    patch = payload.model_dump(exclude_unset=True)
    for k, v in patch.items():
        if v is not None:
            t[k] = v

    t["updated_at"] = now
    _save_tasks_store(container, key, tasks)
    return t


@router.put("/{task_id}/status", summary="Update task status (alias)")
def update_task_status_alias(task_id: str, payload: TaskUpdate) -> Dict[str, Any]:
    # Alias endpoint used by UI actions. Works as upsert too.
    if payload.status is None:
        raise HTTPException(status_code=400, detail="Missing status")
    return upsert_task_internal(task_id, payload)
