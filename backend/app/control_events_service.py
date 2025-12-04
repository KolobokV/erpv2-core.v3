from datetime import date, datetime
from typing import Dict, List, Optional

from .control_event_models import (
    ControlEventModel,
    ControlEventsResponse,
    GeneratedTaskModel,
    GenerateTasksResponse,
)


def _get_reglament_engine_func():
    """
    Lazy import of generate_control_events_for_client to avoid circular imports
    and hard failures on application startup.
    """
    try:
        # Normal absolute import when running as app package
        from app.reglament_engine import generate_control_events_for_client
    except ImportError:
        # Relative import fallback when used inside the app package directly
        from .reglament_engine import generate_control_events_for_client
    return generate_control_events_for_client


def _validate_year_month(year: Optional[int], month: Optional[int]) -> None:
    if year is not None and (year < 2000 or year > 2100):
        raise ValueError("Year must be between 2000 and 2100")
    if month is not None and (month < 1 or month > 12):
        raise ValueError("Month must be between 1 and 12")


def _parse_event_date(raw: Dict) -> date:
    value = raw.get("date")
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError("Event date is missing or has invalid format")


def _normalize_event(raw: Dict, today: date) -> ControlEventModel:
    event_date = _parse_event_date(raw)

    raw_status = str(raw.get("status") or "").strip().lower()
    if raw_status not in {"planned", "overdue", "completed"}:
        if event_date < today:
            raw_status = "overdue"
        else:
            raw_status = "planned"

    depends_raw = raw.get("depends_on") or []
    if isinstance(depends_raw, str):
        depends_list: List[str] = [depends_raw]
    else:
        depends_list = [str(x) for x in depends_raw]

    tags_raw = raw.get("tags") or []
    if isinstance(tags_raw, str):
        tags_list: List[str] = [tags_raw]
    else:
        tags_list = [str(x) for x in tags_raw]

    return ControlEventModel(
        id=str(raw.get("id") or f"event-{event_date.isoformat()}"),
        client_id=str(raw.get("client_id") or ""),
        date=event_date,
        title=str(raw.get("title") or "Unnamed event"),
        category=(raw.get("category") or None),
        status=raw_status,
        depends_on=depends_list,
        description=(raw.get("description") or None),
        tags=tags_list,
        source=(raw.get("source") or "reglament"),
    )


def _filter_events_by_period(
    events: List[Dict],
    year: Optional[int],
    month: Optional[int],
) -> List[Dict]:
    if year is None and month is None:
        return events

    filtered: List[Dict] = []
    for raw in events:
        try:
            event_date = _parse_event_date(raw)
        except Exception:
            # Skip events with invalid date
            continue

        if year is not None and event_date.year != year:
            continue
        if month is not None and event_date.month != month:
            continue

        filtered.append(raw)

    return filtered


def get_control_events_for_client(
    client_id: str,
    year: Optional[int],
    month: Optional[int],
    today: Optional[date] = None,
) -> ControlEventsResponse:
    _validate_year_month(year, month)

    effective_today = today or date.today()
    generate_control_events_for_client = _get_reglament_engine_func()
    raw_events = generate_control_events_for_client(
        client_id=client_id,
        today=effective_today,
    )

    filtered_raw = _filter_events_by_period(raw_events, year, month)
    events: List[ControlEventModel] = [
        _normalize_event(raw, effective_today) for raw in filtered_raw
    ]

    return ControlEventsResponse(
        client_id=client_id,
        year=year,
        month=month,
        events=events,
    )


def _build_task_id(event: ControlEventModel) -> str:
    return f"task-{event.id}"


def generate_tasks_for_client(
    client_id: str,
    year: Optional[int],
    month: Optional[int],
    now: Optional[datetime] = None,
) -> GenerateTasksResponse:
    _validate_year_month(year, month)

    effective_now = now or datetime.utcnow()
    effective_date = effective_now.date()

    generate_control_events_for_client = _get_reglament_engine_func()
    raw_events = generate_control_events_for_client(
        client_id=client_id,
        today=effective_date,
    )
    filtered_raw = _filter_events_by_period(raw_events, year, month)
    events: List[ControlEventModel] = [
        _normalize_event(raw, effective_date) for raw in filtered_raw
    ]

    tasks: List[GeneratedTaskModel] = []

    for event in events:
        due = event.date
        status = event.status

        task = GeneratedTaskModel(
            id=_build_task_id(event),
            client_id=event.client_id,
            title=event.title,
            description=event.description,
            status=status,
            assignee=None,
            created_at=effective_now,
            updated_at=None,
            due_date=due,
            source_event_id=event.id,
            source="reglament",
        )
        tasks.append(task)

    return GenerateTasksResponse(
        client_id=client_id,
        year=year,
        month=month,
        tasks_suggested=len(tasks),
        tasks=tasks,
    )
