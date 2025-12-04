from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Dict, Optional


@dataclass
class ControlEvent:
    id: str
    client_id: str
    date: date
    title: str
    category: str
    status: str = "planned"
    depends_on: Optional[List[str]] = None
    description: str = ""
    tags: Optional[List[str]] = None
    source: str = "reglament"

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "client_id": self.client_id,
            "date": self.date.isoformat(),
            "title": self.title,
            "category": self.category,
            "status": self.status,
            "depends_on": self.depends_on or [],
            "description": self.description,
            "tags": self.tags or [],
            "source": self.source,
        }


def _period_from_today(today: Optional[date]) -> date:
    if today is None:
        return date.today().replace(day=1)
    return today.replace(day=1)


def _make_id(client_id: str, period: date, suffix: str) -> str:
    return f"{client_id}-{period.year:04d}{period.month:02d}-{suffix}"


def _end_of_month(d: date) -> date:
    if d.month == 12:
        return d.replace(day=31)
    first_next = d.replace(
        year=d.year + (1 if d.month == 12 else 0),
        month=1 if d.month == 12 else d.month + 1,
        day=1,
    )
    return first_next - timedelta(days=1)


def _add_overdue_flag(events: List[ControlEvent], today: date) -> None:
    for ev in events:
        if ev.date < today and ev.status == "planned":
            ev.status = "overdue"


# === IP USN DR ===


def _events_ip_usn_dr(period: date) -> List[ControlEvent]:
    events: List[ControlEvent] = []

    client_id = "ip_usn_dr"
    period_end = _end_of_month(period)

    ev_stmt = ControlEvent(
        id=_make_id(client_id, period, "bank-statement"),
        client_id=client_id,
        date=period_end - timedelta(days=5),
        title="Request bank statement for the month",
        category="bank",
        description=(
            "Request full bank statement for the period for further document "
            "request and USN control."
        ),
        tags=["bank", "statement", "ip", "usn_dr", "process:bank_flow"],
    )
    events.append(ev_stmt)

    ev_docs = ControlEvent(
        id=_make_id(client_id, period, "docs-request"),
        client_id=client_id,
        date=period_end - timedelta(days=3),
        title="Request primary documents for the month",
        category="docs",
        depends_on=[ev_stmt.id],
        description=(
            "Request all primary documents corresponding to the bank statement "
            "operations."
        ),
        tags=["docs", "ip", "usn_dr", "process:docs_collect"],
    )
    events.append(ev_docs)

    ev_book = ControlEvent(
        id=_make_id(client_id, period, "usn-book"),
        client_id=client_id,
        date=period_end - timedelta(days=2),
        title="Update USN book and cost register",
        category="tax_usn_book",
        depends_on=[ev_docs.id],
        description="Update USN income and expense book, control tax base and 1 percent limit.",
        tags=["ip", "usn_dr", "book", "process:usn_month_close"],
    )
    events.append(ev_book)

    if period.month in (3, 6, 9, 12):
        quarter_due = date(period.year, period.month, 25)
        ev_usn_adv = ControlEvent(
            id=_make_id(client_id, period, "usn-advance"),
            client_id=client_id,
            date=quarter_due,
            title="USN advance payment for the quarter",
            category="tax_usn",
            depends_on=[ev_book.id],
            description=(
                "Calculate and pay USN advance for the quarter. "
                "Control additional 1 percent tax if needed."
            ),
            tags=["ip", "usn_dr", "tax", "advance", "process:usn_quarter_close"],
        )
        events.append(ev_usn_adv)

    if period.month == 12:
        ev_decl = ControlEvent(
            id=_make_id(client_id, period, "usn-annual-declaration"),
            client_id=client_id,
            date=date(period.year + 1, 4, 25),
            title="USN annual declaration submission",
            category="tax_usn_decl",
            depends_on=[ev_book.id],
            description="Prepare and submit USN annual declaration for the year.",
            tags=["ip", "usn_dr", "declaration", "process:usn_year_close"],
        )
        events.append(ev_decl)

    return events


# === OOO OSNO, 3 employees, salary 10/25 ===


def _events_ooo_osno_3_zp1025(period: date) -> List[ControlEvent]:
    events: List[ControlEvent] = []

    client_id = "ooo_osno_3_zp1025"
    period_end = _end_of_month(period)

    pay_dates = []
    for day in (10, 25):
        try:
            pay_dates.append(date(period.year, period.month, day))
        except ValueError:
            continue

    salary_events: List[ControlEvent] = []
    for idx, pay_date in enumerate(pay_dates, start=1):
        ev_salary = ControlEvent(
            id=_make_id(client_id, period, f"salary-{idx}"),
            client_id=client_id,
            date=pay_date,
            title=f"Salary payment #{idx}",
            category="salary",
            description="Salary payment according to internal payroll schedule.",
            tags=["ooo", "osno", "salary", "process:payroll_cycle"],
        )
        salary_events.append(ev_salary)
        events.append(ev_salary)

        ev_ndfl = ControlEvent(
            id=_make_id(client_id, period, f"ndfl-{idx}"),
            client_id=client_id,
            date=pay_date + timedelta(days=1),
            title=f"NDFL payment after salary #{idx}",
            category="tax_ndfl",
            depends_on=[ev_salary.id],
            description="NDFL payment based on salary payment date.",
            tags=["ooo", "osno", "ndfl", "process:payroll_cycle"],
        )
        events.append(ev_ndfl)

    ev_ins = ControlEvent(
        id=_make_id(client_id, period, "insurance"),
        client_id=client_id,
        date=period_end,
        title="Insurance contributions payment for the month",
        category="insurance",
        depends_on=[e.id for e in salary_events] if salary_events else None,
        description="Monthly social insurance contributions based on payroll.",
        tags=["ooo", "osno", "insurance", "process:payroll_close"],
    )
    events.append(ev_ins)

    ev_stmt = ControlEvent(
        id=_make_id(client_id, period, "bank-statement"),
        client_id=client_id,
        date=period_end - timedelta(days=5),
        title="Request bank statement for the month",
        category="bank",
        description="Request full bank statement including salary and tax payments.",
        tags=["bank", "ooo", "osno", "process:bank_flow"],
    )
    events.append(ev_stmt)

    ev_docs = ControlEvent(
        id=_make_id(client_id, period, "docs-request"),
        client_id=client_id,
        date=period_end - timedelta(days=3),
        title="Request primary documents for the month",
        category="docs",
        depends_on=[ev_stmt.id],
        description=(
            "Request all primary documents (acts, invoices, agreements) "
            "for bookkeeping and VAT control."
        ),
        tags=["docs", "ooo", "osno", "process:docs_collect"],
    )
    events.append(ev_docs)

    if period.month in (3, 6, 9, 12):
        ev_vat = ControlEvent(
            id=_make_id(client_id, period, "vat-decl"),
            client_id=client_id,
            date=date(period.year, period.month, 25),
            title="VAT declaration and payment for the quarter",
            category="tax_vat",
            depends_on=[ev_docs.id],
            description="Prepare and submit VAT declaration, pay VAT for the quarter.",
            tags=["ooo", "osno", "vat", "process:vat_quarter_close"],
        )
        events.append(ev_vat)

        ev_6ndfl = ControlEvent(
            id=_make_id(client_id, period, "6-ndfl"),
            client_id=client_id,
            date=date(period.year, period.month, 30 if period.month in (6, 9) else 31),
            title="6-NDFL reporting for the quarter",
            category="tax_6ndfl",
            depends_on=[e.id for e in salary_events] if salary_events else None,
            description="Prepare and submit 6-NDFL report for the quarter.",
            tags=["ooo", "osno", "6-ndfl", "process:payroll_reports"],
        )
        events.append(ev_6ndfl)

        ev_rsv = ControlEvent(
            id=_make_id(client_id, period, "rsv"),
            client_id=client_id,
            date=ev_6ndfl.date,
            title="RSV reporting for the quarter",
            category="tax_rsv",
            depends_on=[ev_ins.id],
            description="Prepare and submit RSV report for the quarter.",
            tags=["ooo", "osno", "rsv", "process:payroll_reports"],
        )
        events.append(ev_rsv)

    if period.month == 12:
        ev_bal = ControlEvent(
            id=_make_id(client_id, period, "annual-balance"),
            client_id=client_id,
            date=date(period.year + 1, 3, 31),
            title="Annual accounting statements",
            category="annual_report",
            depends_on=[ev_docs.id],
            description="Prepare and submit annual accounting statements.",
            tags=["ooo", "osno", "annual", "process:year_close"],
        )
        events.append(ev_bal)

        ev_szv = ControlEvent(
            id=_make_id(client_id, period, "szv-stazh"),
            client_id=client_id,
            date=date(period.year + 1, 3, 1),
            title="SZV-STAZH annual report",
            category="pension_report",
            depends_on=[ev_ins.id],
            description="Prepare and submit SZV-STAZH for all employees.",
            tags=["ooo", "osno", "szv-stazh", "process:year_close"],
        )
        events.append(ev_szv)

    return events


# === OOO USN DR + tourist tax, salary 5/20 ===


def _events_ooo_usn_dr_tour_zp520(period: date) -> List[ControlEvent]:
    events: List[ControlEvent] = []

    client_id = "ooo_usn_dr_tour_zp520"
    period_end = _end_of_month(period)

    pay_dates = []
    for day in (5, 20):
        try:
            pay_dates.append(date(period.year, period.month, day))
        except ValueError:
            continue

    salary_events: List[ControlEvent] = []
    for idx, pay_date in enumerate(pay_dates, start=1):
        ev_salary = ControlEvent(
            id=_make_id(client_id, period, f"salary-{idx}"),
            client_id=client_id,
            date=pay_date,
            title=f"Salary payment #{idx}",
            category="salary",
            description="Salary payment according to internal payroll schedule.",
            tags=["ooo", "usn_dr", "tourist_fee", "salary", "process:payroll_cycle"],
        )
        salary_events.append(ev_salary)
        events.append(ev_salary)

        ev_ndfl = ControlEvent(
            id=_make_id(client_id, period, f"ndfl-{idx}"),
            client_id=client_id,
            date=pay_date + timedelta(days=1),
            title=f"NDFL payment after salary #{idx}",
            category="tax_ndfl",
            depends_on=[ev_salary.id],
            description="NDFL payment based on salary payment date.",
            tags=["ooo", "usn_dr", "ndfl", "process:payroll_cycle"],
        )
        events.append(ev_ndfl)

    ev_ins = ControlEvent(
        id=_make_id(client_id, period, "insurance"),
        client_id=client_id,
        date=period_end,
        title="Insurance contributions payment for the month",
        category="insurance",
        depends_on=[e.id for e in salary_events] if salary_events else None,
        description="Monthly social insurance contributions based on payroll.",
        tags=["ooo", "usn_dr", "insurance", "process:payroll_close"],
    )
    events.append(ev_ins)

    ev_tour = ControlEvent(
        id=_make_id(client_id, period, "tourist-fee"),
        client_id=client_id,
        date=period_end - timedelta(days=3),
        title="Tourist fee calculation and payment",
        category="tax_tourist",
        description=(
            "Calculate and pay tourist fee for the month based on guests statistics."
        ),
        tags=["ooo", "usn_dr", "tourist_fee", "process:tourist_fee_month"],
    )
    events.append(ev_tour)

    ev_stmt = ControlEvent(
        id=_make_id(client_id, period, "bank-statement"),
        client_id=client_id,
        date=period_end - timedelta(days=5),
        title="Request bank statement for the month",
        category="bank",
        description="Request bank statement including tourist fee and payroll operations.",
        tags=["bank", "ooo", "usn_dr", "process:bank_flow"],
    )
    events.append(ev_stmt)

    ev_docs = ControlEvent(
        id=_make_id(client_id, period, "docs-request"),
        client_id=client_id,
        date=period_end - timedelta(days=3),
        title="Request primary documents for the month",
        category="docs",
        depends_on=[ev_stmt.id],
        description=(
            "Request acts, invoices and hotel or hostel documents for "
            "tourist fee and USN control."
        ),
        tags=["docs", "ooo", "usn_dr", "tourist_fee", "process:docs_collect"],
    )
    events.append(ev_docs)

    if period.month in (3, 6, 9, 12):
        ev_usn_adv = ControlEvent(
            id=_make_id(client_id, period, "usn-advance"),
            client_id=client_id,
            date=date(period.year, period.month, 25),
            title="USN advance payment for the quarter",
            category="tax_usn",
            depends_on=[ev_docs.id],
            description="Calculate and pay USN advance for the quarter.",
            tags=["ooo", "usn_dr", "tax", "advance", "process:usn_quarter_close"],
        )
        events.append(ev_usn_adv)

    if period.month == 12:
        ev_usn_decl = ControlEvent(
            id=_make_id(client_id, period, "usn-annual-declaration"),
            client_id=client_id,
            date=date(period.year + 1, 3, 31),
            title="USN annual declaration submission",
            category="tax_usn_decl",
            depends_on=[ev_docs.id],
            description="Prepare and submit USN annual declaration.",
            tags=["ooo", "usn_dr", "declaration", "process:usn_year_close"],
        )
        events.append(ev_usn_decl)

        ev_szv = ControlEvent(
            id=_make_id(client_id, period, "szv-stazh"),
            client_id=client_id,
            date=date(period.year + 1, 3, 1),
            title="SZV-STAZH annual report",
            category="pension_report",
            depends_on=[ev_ins.id],
            description="Prepare and submit SZV-STAZH for all employees.",
            tags=["ooo", "usn_dr", "szv-stazh", "process:year_close"],
        )
        events.append(ev_szv)

    return events


def _events_fallback(client_id: str, period: date) -> List[ControlEvent]:
    period_end = _end_of_month(period)
    ev = ControlEvent(
        id=_make_id(client_id, period, "generic-monthly-review"),
        client_id=client_id,
        date=period_end,
        title="Generic monthly review",
        category="generic",
        description=(
            "Generic monthly review event generated by reglament engine "
            "for unknown client_id."
        ),
        tags=["generic", "process:generic_month"],
    )
    return [ev]


def generate_control_events_for_client(
    client_id: str, today: Optional[date] = None
) -> List[Dict]:
    """
    Main entry point used by control_events_service.

    client_id: business key of the client
    today: reference date; period is taken as the month of this date.
    """
    period = _period_from_today(today)

    if client_id == "ip_usn_dr":
        events = _events_ip_usn_dr(period)
    elif client_id == "ooo_osno_3_zp1025":
        events = _events_ooo_osno_3_zp1025(period)
    elif client_id == "ooo_usn_dr_tour_zp520":
        events = _events_ooo_usn_dr_tour_zp520(period)
    else:
        events = _events_fallback(client_id, period)

    reference_date = today or date.today()
    _add_overdue_flag(events, reference_date)

    return [e.to_dict() for e in events]
