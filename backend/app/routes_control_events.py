from datetime import date, timedelta
import calendar
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Query

router = APIRouter()


def first_working_day(year: int, month: int) -> date:
    """Return first working day (Mon-Fri) of given month."""
    d = date(year, month, 1)
    while d.weekday() >= 5:  # 5=Sat, 6=Sun
        d += timedelta(days=1)
    return d


def create_salary_events(
    year: int,
    month: int,
    days: List[int],
    client_id: str,
    label: str,
) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    _, last_day = calendar.monthrange(year, month)

    for d in days:
        if d < 1 or d > last_day:
            continue
        events.append(
            {
                "id": f"salary_{d}",
                "client_id": client_id,
                "title": f"Salary payment ({label})",
                "date": date(year, month, d).isoformat(),
                "category": "salary",
            }
        )
    return events


def build_events_for_client(
    client_id: str,
    year: int,
    month: int,
) -> List[Dict[str, Any]]:
    """
    Minimal demo logic for control events.
    Later this will be replaced by real client profiles + scheduler rules.
    """

    events: List[Dict[str, Any]] = []

    # base bank statement + documents chain
    statement_date = first_working_day(year, month)
    events.append(
        {
            "id": "monthly_statement_request",
            "client_id": client_id,
            "title": "Monthly bank statement request",
            "date": statement_date.isoformat(),
            "category": "bank",
        }
    )

    events.append(
        {
            "id": "documents_request_after_statement",
            "client_id": client_id,
            "title": "Request documents after bank statement",
            "date": (statement_date + timedelta(days=1)).isoformat(),
            "category": "documents",
            "depends_on": "monthly_statement_request",
        }
    )

    # client-specific salary schedule (demo)
    if client_id == "ip_usn_demo":
        # IP USN: single salary date, for example 10th
        salary_days = [10]
        events.extend(
            create_salary_events(year, month, salary_days, client_id, "IP USN demo")
        )
    elif client_id == "ooo_vat_demo":
        # LLC with VAT: 3 employees, salary 10 and 25
        salary_days = [10, 25]
        events.extend(
            create_salary_events(
                year, month, salary_days, client_id, "LLC with VAT demo"
            )
        )
    elif client_id == "ooo_usn_tour_demo":
        # LLC USN + tourist fee: salary 5 and 20
        salary_days = [5, 20]
        events.extend(
            create_salary_events(
                year, month, salary_days, client_id, "LLC USN + tourist demo"
            )
        )
    else:
        # default: only bank statement and documents
        pass

    # sort events by date, then by id
    events.sort(key=lambda e: (e["date"], e["id"]))
    return events


@router.get("/control-events/{client_id}")
def get_control_events(
    client_id: str,
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
):
    """
    Return control events for a client for given year/month.
    If year/month are not provided, current year/month are used.
    """

    today = date.today()
    effective_year = year or today.year
    effective_month = month or today.month

    events = build_events_for_client(client_id, effective_year, effective_month)

    return {
        "client_id": client_id,
        "year": effective_year,
        "month": effective_month,
        "events": events,
    }
