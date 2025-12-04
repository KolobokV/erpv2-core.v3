from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Literal, Optional


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
            "source": self.source or "demo",
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

    def _demo_events_for_client(self, client_id: str) -> List[ControlEvent]:
        today = date.today()
        events: List[ControlEvent] = []

        # event 1: overdue
        e1_date = today - timedelta(days=3)
        e1 = ControlEvent(
            id=f"{client_id}-bank-statement-{e1_date.isoformat()}",
            client_id=client_id,
            date=e1_date,
            title="Bank statement request",
            category="bank",
            status=self._compute_status(e1_date),
            depends_on=[],
            description="Monthly bank statement request for previous month.",
            tags=["bank", "statement", "monthly"],
            source="demo",
        )
        events.append(e1)

        # event 2: today + dependency
        e2_date = today
        e2 = ControlEvent(
            id=f"{client_id}-primary-docs-{e2_date.isoformat()}",
            client_id=client_id,
            date=e2_date,
            title="Primary documents request",
            category="documents",
            status=self._compute_status(e2_date),
            depends_on=[e1.id],
            description="Request primary documents after bank statement is received.",
            tags=["docs", "monthly"],
            source="demo",
        )
        events.append(e2)

        # event 3: future
        e3_date = today + timedelta(days=10)
        e3 = ControlEvent(
            id=f"{client_id}-tax-payment-{e3_date.isoformat()}",
            client_id=client_id,
            date=e3_date,
            title="Tax payment deadline",
            category="tax",
            status=self._compute_status(e3_date),
            depends_on=[e2.id],
            description="Planned tax payment based on current reporting period.",
            tags=["tax", "deadline"],
            source="demo",
        )
        events.append(e3)

        return events

    def get_events_for_client(self, client_id: str) -> List[dict]:
        events = self._demo_events_for_client(client_id=client_id)
        return [e.to_dict() for e in events]


control_events_service = ControlEventsService()
