from typing import List, Optional, Any, Dict
from pathlib import Path
import json

from fastapi import APIRouter, Query

router = APIRouter()


def load_json_store(name: str):
    """
    Load JSON store from project root (ERPv2_backend_connect).
    """
    # app/api/routes_process_overview.py -> app/api -> app -> ERPv2_backend_connect
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


def make_period(year: Optional[int], month: Optional[int]) -> Optional[str]:
    if year is None or month is None:
        return None
    return f"{year}-{str(month).zfill(2)}"


def match_period(obj: Dict[str, Any], year: Optional[int], month: Optional[int]) -> bool:
    """
    Match by:
    - obj["period"] == "YYYY-MM", or
    - obj["year"] == year and obj["month"] == month
    """
    if year is None or month is None:
        return True

    target_period = make_period(year, month)
    if obj.get("period") == target_period:
        return True

    oy = obj.get("year")
    om = obj.get("month")
    if oy is None or om is None:
        return False

    try:
        om_int = int(om)
    except Exception:
        return False

    return int(oy) == int(year) and om_int == int(month)


@router.get("/internal/process-overview/client/{client_id}")
def get_client_process_overview(
    client_id: str,
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
):
    client_id = str(client_id)

    instances = [
        inst for inst in load_instances()
        if str(inst.get("client_id")) == client_id
    ]

    instance: Optional[Dict[str, Any]] = None

    # Try match by requested period
    if year is not None and month is not None:
        for inst in instances:
            if match_period(inst, year, month):
                instance = inst
                break

    # Fallback: last instance for this client
    if instance is None and instances:
        instance = instances[-1]

    steps: List[Dict[str, Any]] = []
    if instance:
        raw_steps = instance.get("steps") or []
        if isinstance(raw_steps, list):
            steps = raw_steps

    # Control events for this client and period
    events_all = load_control_events()
    control_events: List[Dict[str, Any]] = []
    for ev in events_all:
        if str(ev.get("client_id")) != client_id:
            continue
        if not match_period(ev, year, month):
            continue
        control_events.append(ev)

    meta = {
        "client_id": client_id,
        "query_year": year,
        "query_month": month,
        "query_period": make_period(year, month),
        "instance_id": instance.get("id") if instance else None,
        "instance_period": instance.get("period") if instance else None,
        "steps_count": len(steps),
        "control_events_count": len(control_events),
    }

    return {
        "instance": instance or {},
        "steps": steps,
        "control_events": control_events,
        "meta": meta,
    }
