import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

BASE_DIR = Path(__file__).resolve().parent.parent.parent
INSTANCES_PATH = BASE_DIR / "process_instances_store.json"
PROFILES_PATH = BASE_DIR / "client_profiles_store.json"

router = APIRouter(
    prefix="/api/internal/process-instances-v2",
    tags=["internal.process_instances_v2"],
)


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        raw = path.read_text(encoding="utf-8-sig")
    except Exception:
        raw = path.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except Exception:
        return default


def _load_instances_raw() -> Any:
    """
    Load raw instances store as is.

    Supported legacy formats:
      - dict: { "<key>": { ... }, ... }
      - list: [ { ... }, ... ]
    """
    return _load_json(INSTANCES_PATH, {})


def _load_profiles_map() -> Dict[str, str]:
    """
    Return mapping client_code -> label.
    """
    data = _load_json(PROFILES_PATH, {"profiles": []})
    profiles = []
    if isinstance(data, dict) and isinstance(data.get("profiles"), list):
        profiles = data["profiles"]
    elif isinstance(data, list):
        profiles = data

    result: Dict[str, str] = {}
    for p in profiles:
        code = p.get("code")
        label = p.get("label") or p.get("name") or code
        if code:
            result[code] = label or code
    return result


def _normalize_instances() -> List[Dict[str, Any]]:
    """
    Normalize raw instances into flat list with derived fields.

    Output fields:
      - instance_key
      - client_code
      - client_label
      - year
      - month
      - period (YYYY-MM)
      - status
      - steps_count
      - ...all original fields
    """
    raw = _load_instances_raw()
    profiles_map = _load_profiles_map()

    items: List[Dict[str, Any]] = []

    if isinstance(raw, dict):
        iterable = raw.items()
    elif isinstance(raw, list):
        iterable = [(None, it) for it in raw]
    else:
        iterable = []

    for key, value in iterable:
        if not isinstance(value, dict):
            continue

        inst = dict(value)

        client_code = inst.get("client_code") or inst.get("client_id")
        year = inst.get("year")
        month = inst.get("month")
        period = inst.get("period")

        if period and (not year or not month):
            # try to parse YYYY-MM
            parts = str(period).split("-")
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                year = int(parts[0])
                month = int(parts[1])
        if (year is not None) and (month is not None) and not period:
            period = f"{int(year):04d}-{int(month):02d}"

        status = inst.get("status") or "unknown"
        steps = inst.get("steps") or []
        if isinstance(steps, dict):
            steps_count = len(steps.get("items", []))
        elif isinstance(steps, list):
            steps_count = len(steps)
        else:
            steps_count = 0

        instance_key = key or inst.get("key") or (
            f"{client_code}::{period}" if client_code and period else None
        )

        client_label = profiles_map.get(client_code or "", client_code)

        inst["instance_key"] = instance_key
        inst["client_code"] = client_code
        inst["client_label"] = client_label
        inst["year"] = year
        inst["month"] = month
        inst["period"] = period
        inst["status"] = status
        inst["steps_count"] = steps_count

        items.append(inst)

    return items


@router.get("/")
def list_instances(
    client_code: Optional[str] = Query(None),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    period: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """
    Unified list of process instances for coverage / internal tools.

    Filters are optional; if omitted, all instances are returned.
    """
    items = _normalize_instances()
    result: List[Dict[str, Any]] = []

    for inst in items:
        if client_code and inst.get("client_code") != client_code:
            continue

        if period:
            if inst.get("period") != period:
                continue
        else:
            if year is not None and inst.get("year") != year:
                continue
            if month is not None and inst.get("month") != month:
                continue

        result.append(inst)

    return result
