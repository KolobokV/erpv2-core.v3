from pathlib import Path
import json
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

router = APIRouter()


def load_json_store(name: str):
    root = Path(__file__).resolve().parents[2]
    path = root / name
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def load_instances() -> List[Dict[str, Any]]:
    data = load_json_store("process_instances_store.json")
    return data if isinstance(data, list) else []


def load_control_events() -> List[Dict[str, Any]]:
    data = load_json_store("control_events_store.json")
    return data if isinstance(data, list) else []


@router.get("/internal/process-overview/step/{step_id}")
def zoom_step(step_id: str):
    step_id = str(step_id)
    instances = load_instances()

    for inst in instances:
        steps = inst.get("steps") or []
        for step in steps:
            if str(step.get("id")) == step_id:
                return {
                    "step": step,
                    "instance": inst,
                    "instance_id": inst.get("id"),
                    "client_id": inst.get("client_id"),
                    "year": inst.get("year"),
                    "month": inst.get("month"),
                    "period": inst.get("period"),
                }

    raise HTTPException(status_code=404, detail="Step not found")


@router.get("/internal/process-overview/event/{event_id}")
def zoom_event(event_id: str):
    event_id = str(event_id)
    events = load_control_events()

    for ev in events:
        if str(ev.get("id")) == event_id:
            return {
                "event": ev,
                "event_id": ev.get("id"),
                "client_id": ev.get("client_id"),
                "instance_id": ev.get("instance_id"),
                "year": ev.get("year"),
                "month": ev.get("month"),
                "period": ev.get("period"),
            }

    raise HTTPException(status_code=404, detail="Event not found")
