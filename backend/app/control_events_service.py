from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Literal, Optional

from .reglament_engine import generate_control_events_for_client


StatusType = Literal["planned", "overdue", "completed"]


@dataclass
class ControlEvent:
    id: str
    client_id: str
    date: date
    title: str
    category: str
    status: StatusType
    depends_on: List[str]
    description: Optional[str] = None
    tags: List[str] | None = None
    source: str | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "date": self.date.isoformat(),
            "title": self.title,
            "category": self.category,
            "status": self.status,
            "depends_on": self.depends_on,
            "description": self.description,
            "tags": self.tags or [],
            "source": self.source or "reglament",
        }


class ControlEventsService:
    def __init__(self) -> None:
        pass

    @staticmethod
    def _compute_status(event_date: date, completed: bool = False) -> StatusType:
        today = date.today()
        if completed:
            return "completed"
        if event_date < today:
            return "overdue"
        return "planned"

    def _events_for_client(
        self,
        client_id: str,
        year: int | None = None,
        month: int | None = None,
    ) -> List[ControlEvent]:
        today = date.today()
        base_today = today

        if year is not None:
            try:
                base_today = date(year, today.month, today.day)
            except ValueError:
                base_today = date(year, 1, 1)

        base_events = generate_control_events_for_client(
            client_id=client_id,
            today=base_today,
        )

        events: List[ControlEvent] = []

        for base in base_events:
            ev_date = base["date"]

            if year is not None and ev_date.year != year:
                continue

            if month is not None and ev_date.month != month:
                continue

            status = self._compute_status(ev_date)

            events.append(
                ControlEvent(
                    id=base["id"],
                    client_id=base["client_id"],
                    date=ev_date,
                    title=base["title"],
                    category=base["category"],
                    status=status,
                    depends_on=base.get("depends_on", []),
                    description=base.get("description"),
                    tags=base.get("tags") or [],
                    source=base.get("source") or "reglament",
                )
            )

        return events

    def get_events_for_client(
        self,
        client_id: str,
        year: int | None = None,
        month: int | None = None,
    ) -> List[dict]:
        events = self._events_for_client(
            client_id=client_id,
            year=year,
            month=month,
        )
        return [e.to_dict() for e in events]

    def build_task_payloads_for_client(
        self,
        client_id: str,
        year: int | None = None,
        month: int | None = None,
    ) -> List[dict]:
        """
        Build task payloads (compatible with TaskModel) from control events
        for given client. This endpoint does not persist tasks, it only
        returns suggested payloads.
        """
        events = self.get_events_for_client(
            client_id=client_id,
            year=year,
            month=month,
        )
        now_iso = datetime.utcnow().isoformat()

        tasks: List[dict] = []
        for ev in events:
            tasks.append(
                {
                    "id": f"task-{ev['id']}",
                    "title": ev["title"],
                    "description": ev.get("description")
                    or f"{ev['category']} event on {ev['date']}",
                    "status": ev["status"],
                    "assignee": None,
                    "created_at": now_iso,
                    "updated_at": None,
                    "due_date": ev["date"],
                }
            )
        return tasks


control_events_service = ControlEventsService()
