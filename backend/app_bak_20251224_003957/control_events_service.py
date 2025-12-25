from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from . import reglament_engine


ControlEventDict = Dict[str, Any]
TaskDict = Dict[str, Any]


def _parse_year_month(
    year: Any = None,
    month: Any = None,
) -> Tuple[int, int]:
    """
    Robust parser for year and month.

    Accepts int, str or None and normalizes into (year, month) in valid range.
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


def _infer_process_id_from_tags(tags: Optional[List[str]]) -> Optional[str]:
    if not tags:
      return None
    for t in tags:
      if isinstance(t, str) and t.startswith("process:"):
        return t
    return None


def get_control_events_for_client(
    client_id: str,
    year: Any = None,
    month: Any = None,
) -> Dict[str, Any]:
    """
    Returns control events for given client and period.

    Used by GET /api/control-events/{client_id}.
    """
    y, m = _parse_year_month(year, month)
    period_ref = date(y, m, 1)

    events: List[ControlEventDict] = reglament_engine.generate_control_events_for_client(
        client_id=client_id,
        today=period_ref,
    )

    events_filtered: List[ControlEventDict] = []
    for ev in events:
        d_raw = ev.get("date")
        if not isinstance(d_raw, str):
            events_filtered.append(ev)
            continue
        if len(d_raw) < 7:
            events_filtered.append(ev)
            continue
        try:
            ev_year = int(d_raw[0:4])
            ev_month = int(d_raw[5:7])
        except ValueError:
            events_filtered.append(ev)
            continue
        if ev_year == y and ev_month == m:
            events_filtered.append(ev)

    return {
        "client_id": client_id,
        "year": y,
        "month": m,
        "events": events_filtered,
    }


def generate_tasks_for_client(
    client_id: str,
    year: Any = None,
    month: Any = None,
) -> Dict[str, Any]:
    """
    Builds tasks based on control events and does NOT persist them.

    Returned payload shape is simple and backend-agnostic:
    {
      "client_id": str,
      "tasks_suggested": int,
      "tasks": [
        {
          "title": str,
          "description": str,
          "status": "planned" | "overdue",
          "due_date": "YYYY-MM-DD" | null,
          "client_id": str | null,
          "process_id": str | null,
          "tags": list[str]
        }
      ]
    }
    """
    y, m = _parse_year_month(year, month)

    events_response = get_control_events_for_client(
        client_id=client_id,
        year=y,
        month=m,
    )
    events = events_response.get("events", []) or []

    tasks: List[TaskDict] = []

    for ev in events:
        ev_id = str(ev.get("id", ""))
        ev_title = str(ev.get("title", "") or "").strip()
        ev_desc = str(ev.get("description", "") or "").strip()
        ev_status = str(ev.get("status", "") or "").lower() or "planned"
        ev_date = str(ev.get("date", "") or "")
        ev_tags = ev.get("tags") or []

        if not ev_title:
            ev_title = f"Control event {ev_id or '(no id)'}"

        if not ev_desc:
            ev_desc = (
                f"Task generated from control event {ev_id} for client {client_id}."
            )

        task_status = "overdue" if ev_status == "overdue" else "planned"
        process_id = _infer_process_id_from_tags(
            [t for t in ev_tags if isinstance(t, str)]
        )

        task: TaskDict = {
            "title": ev_title,
            "description": ev_desc,
            "status": task_status,
            "due_date": ev_date or None,
            "client_id": client_id,
            "process_id": process_id,
            "instance_id": None,
            "tags": ev_tags,
        }

        tasks.append(task)

    return {
        "client_id": client_id,
        "tasks_suggested": len(tasks),
        "tasks": tasks,
    }
