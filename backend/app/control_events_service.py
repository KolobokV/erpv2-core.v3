from __future__ import annotations

from datetime import date
from typing import Any, Dict, List
import calendar


StatusType = str  # "planned" | "overdue" | "completed"
SourceType = str  # "tax_calendar" | "internal" | "contractual"


def _get_last_day_of_month(year: int, month: int) -> int:
    _, last_day = calendar.monthrange(year, month)
    return last_day


def generate_demo_events(client_id: str, year: int, month: int) -> List[Dict[str, Any]]:
    period_key = f"{year:04d}-{month:02d}"
    last_day = _get_last_day_of_month(year, month)

    events: List[Dict[str, Any]] = []

    events.append(
        {
            "id": f"evt_{period_key}_bank_statement",
            "clientId": client_id,
            "date": date(year, month, 1),
            "kind": "bank_statement_request",
            "title": "Request bank statement",
            "description": (
                "Request bank statement from client for the period "
                f"{period_key}."
            ),
            "source": "internal",
            "status": "planned",
            "isCritical": True,
            "relatedTaskId": None,
            "tags": ["bank", "documents", "monthly"],
            "meta": {
                "period": period_key,
                "lawRef": None,
                "amountType": "unknown",
            },
        }
    )

    events.append(
        {
            "id": f"evt_{period_key}_primary_docs",
            "clientId": client_id,
            "date": date(year, month, 2),
            "kind": "primary_documents_request",
            "title": "Request primary documents",
            "description": "Request primary accounting documents for the month.",
            "source": "internal",
            "status": "planned",
            "isCritical": True,
            "relatedTaskId": None,
            "tags": ["documents", "monthly"],
            "meta": {
                "period": period_key,
                "lawRef": None,
                "amountType": "unknown",
            },
        }
    )

    salary_day = min(15, last_day)
    events.append(
        {
            "id": f"evt_{period_key}_salary_payment",
            "clientId": client_id,
            "date": date(year, month, salary_day),
            "kind": "salary_payment",
            "title": "Salary payment",
            "description": "Regular salary payment according to internal schedule.",
            "source": "internal",
            "status": "planned",
            "isCritical": True,
            "relatedTaskId": None,
            "tags": ["salary", "payment"],
            "meta": {
                "period": period_key,
                "lawRef": None,
                "amountType": "unknown",
            },
        }
    )

    events.append(
        {
            "id": f"evt_{period_key}_tax_payment",
            "clientId": client_id,
            "date": date(year, month, last_day),
            "kind": "tax_payment",
            "title": "Tax payment",
            "description": "Generic tax payment deadline for the period.",
            "source": "tax_calendar",
            "status": "planned",
            "isCritical": True,
            "relatedTaskId": None,
            "tags": ["tax", "deadline"],
            "meta": {
                "period": period_key,
                "lawRef": None,
                "amountType": "unknown",
            },
        }
    )

    return events
