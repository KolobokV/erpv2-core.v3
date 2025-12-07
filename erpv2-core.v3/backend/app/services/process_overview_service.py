from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Tuple

from app.control_events_service import get_control_events_for_client
from app.services.process_instances_service import (
    find_or_create_process_instance_from_event,
    list_process_instances_for_client,
)


def _parse_year_month_safe(year: Any = None, month: Any = None) -> Tuple[int, int]:
    """
    Local copy of year/month parser to avoid importing internals.
    """
    today = date.today()

    # year
    if year is None:
        y = today.year
    else:
        try:
            y = int(year)
        except (TypeError, ValueError):
            y = today.year

    # month
    if month is None:
        m = today.month
    else:
        try:
            m = int(month)
        except (TypeError, ValueError):
            m = today.month

    if m < 1:
        m = 1
    if m > 12:
        m = 12

    return y, m


def get_client_process_overview(
    client_id: str,
    year: Any = None,
    month: Any = None,
) -> Dict[str, Any]:
    """
    Build combined view for a client and period:

    - control events for the given period
    - process instance for each event (created if missing)
    - list of instances for the same client + period
    """
    y, m = _parse_year_month_safe(year, month)

    events_payload = get_control_events_for_client(
        client_id=client_id,
        year=y,
        month=m,
    )
    events: List[Dict[str, Any]] = events_payload.get("events", []) or []

    period_str = f"{y:04d}-{m:02d}"

    events_with_instances: List[Dict[str, Any]] = []

    for ev in events:
        instance_id = None
        instance_status = None
        instance_steps_count = 0

        try:
            inst = find_or_create_process_instance_from_event(ev)
            if isinstance(inst, dict):
                raw_id = inst.get("id")
                if isinstance(raw_id, str) and raw_id.strip():
                    instance_id = raw_id.strip()
                instance_status_val = inst.get("status")
                if isinstance(instance_status_val, str):
                    instance_status = instance_status_val
                steps = inst.get("steps") or []
                if isinstance(steps, list):
                    instance_steps_count = len(steps)
        except Exception:
            instance_id = None
            instance_status = None
            instance_steps_count = 0

        events_with_instances.append(
            {
                "event": ev,
                "instance_id": instance_id,
                "instance_status": instance_status,
                "instance_steps_count": instance_steps_count,
            }
        )

    instances_for_period = list_process_instances_for_client(
        client_id=client_id,
        period=period_str,
    )

    return {
        "client_id": client_id,
        "year": y,
        "month": m,
        "period": period_str,
        "events": events_with_instances,
        "instances": instances_for_period,
    }
