from __future__ import annotations

from datetime import date, timedelta
from typing import List, Dict, Any


def _first_workday(year: int, month: int) -> date:
    d = date(year, month, 1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def _event_base(
    client_id: str,
    event_date: date,
    slug: str,
    title: str,
    category: str,
    description: str = "",
    depends_on: List[str] | None = None,
    tags: List[str] | None = None,
    source: str = "reglament",
) -> Dict[str, Any]:
    return {
        "id": f"{client_id}-{slug}-{event_date.isoformat()}",
        "client_id": client_id,
        "date": event_date,
        "title": title,
        "category": category,
        "depends_on": depends_on or [],
        "description": description or None,
        "tags": tags or [],
        "source": source,
    }


def _generate_ip_usn_dr(client_id: str, today: date) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    year = today.year

    # monthly: bank statement + docs + insurance control
    for month in range(1, 13):
        # first workday: bank statement request
        bank_date = _first_workday(year, month)
        bank_ev = _event_base(
            client_id=client_id,
            event_date=bank_date,
            slug="bank-statement",
            title="Bank statement request",
            category="bank",
            description="Bank statement request for previous month.",
            tags=["bank", "statement", "monthly"],
        )
        events.append(bank_ev)

        # docs after bank statement
        docs_ev = _event_base(
            client_id=client_id,
            event_date=bank_date,
            slug="docs-request",
            title="Primary documents request",
            category="documents",
            description="Request primary documents after bank statement is received.",
            depends_on=[bank_ev["id"]],
            tags=["docs", "monthly"],
        )
        events.append(docs_ev)

        # insurance contributions control around 20th
        ins_date = date(year, month, 20)
        ins_ev = _event_base(
            client_id=client_id,
            event_date=ins_date,
            slug="insurance-self-control",
            title="Insurance contributions self-check",
            category="insurance",
            description="Control of personal insurance contributions for current month.",
            tags=["insurance", "monthly"],
        )
        events.append(ins_ev)

    # quarterly: USN advances (25 Apr, 25 Jul, 25 Oct)
    quarters = [
        (4, 25, "q1"),
        (7, 25, "q2"),
        (10, 25, "q3"),
    ]
    for month, day, qslug in quarters:
        d = date(year, month, day)
        ev = _event_base(
            client_id=client_id,
            event_date=d,
            slug=f"usn-advance-{qslug}",
            title="USN advance payment",
            category="tax",
            description="Quarterly USN advance payment.",
            tags=["usn", "advance", "quarterly"],
        )
        events.append(ev)

    # yearly: USN declaration and final contributions
    usn_decl = date(year, 4, 30)
    events.append(
        _event_base(
            client_id=client_id,
            event_date=usn_decl,
            slug="usn-declaration",
            title="USN annual declaration",
            category="tax",
            description="Annual USN declaration.",
            tags=["usn", "annual"],
        )
    )

    contrib_final = date(year, 7, 1)
    events.append(
        _event_base(
            client_id=client_id,
            event_date=contrib_final,
            slug="insurance-final",
            title="Insurance contributions final payment",
            category="insurance",
            description="Final payment of fixed contributions and 1 percent.",
            tags=["insurance", "annual"],
        )
    )

    return events


def _generate_ooo_osno_3_zp1025(client_id: str, today: date) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    year = today.year

    # monthly salary, ndfl, insurance, bank/docs
    for month in range(1, 13):
        # salary: advance and main
        adv_date = date(year, month, 10)
        main_date = date(year, month, 25)

        adv_ev = _event_base(
            client_id=client_id,
            event_date=adv_date,
            slug="salary-advance",
            title="Salary advance payment",
            category="salary",
            description="Advance salary payment.",
            tags=["salary", "monthly"],
        )
        events.append(adv_ev)

        main_ev = _event_base(
            client_id=client_id,
            event_date=main_date,
            slug="salary-main",
            title="Salary main payment",
            category="salary",
            description="Main salary payment.",
            tags=["salary", "monthly"],
        )
        events.append(main_ev)

        # ndfl next day after salary
        ndfl_adv = adv_date + timedelta(days=1)
        ndfl_main = main_date + timedelta(days=1)

        events.append(
            _event_base(
                client_id=client_id,
                event_date=ndfl_adv,
                slug="ndfl-advance",
                title="NDFL payment after advance",
                category="tax",
                description="NDFL payment for salary advance.",
                depends_on=[adv_ev["id"]],
                tags=["ndfl", "monthly"],
            )
        )
        events.append(
            _event_base(
                client_id=client_id,
                event_date=ndfl_main,
                slug="ndfl-main",
                title="NDFL payment after salary",
                category="tax",
                description="NDFL payment for main salary.",
                depends_on=[main_ev["id"]],
                tags=["ndfl", "monthly"],
            )
        )

        # insurance contributions (control around 15th)
        ins_date = date(year, month, 15)
        events.append(
            _event_base(
                client_id=client_id,
                event_date=ins_date,
                slug="insurance-control",
                title="Insurance contributions control",
                category="insurance",
                description="Control of insurance contributions for previous month.",
                tags=["insurance", "monthly"],
            )
        )

        # monthly bank and docs
        bank_date = _first_workday(year, month)
        bank_ev = _event_base(
            client_id=client_id,
            event_date=bank_date,
            slug="bank-statement",
            title="Bank statement request",
            category="bank",
            description="Bank statement request for previous month.",
            tags=["bank", "statement", "monthly"],
        )
        events.append(bank_ev)

        docs_ev = _event_base(
            client_id=client_id,
            event_date=bank_date,
            slug="docs-request",
            title="Primary documents request",
            category="documents",
            description="Request primary documents after bank statement is received.",
            depends_on=[bank_ev["id"]],
            tags=["docs", "monthly"],
        )
        events.append(docs_ev)

        # monthly 6-NDFL control (end of month)
        # last day of month: simple approach
        if month == 12:
            last_day = date(year, 12, 31)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)

        events.append(
            _event_base(
                client_id=client_id,
                event_date=last_day,
                slug="6-ndfl-monthly-control",
                title="6-NDFL monthly control",
                category="report",
                description="Monthly control of 6-NDFL (section 1).",
                tags=["6-ndfl", "monthly"],
            )
        )

    # quarterly: VAT, 6-NDFL, RSV (reports)
    # Q1, Q2, Q3 due: 25 Apr, 25 Jul, 25 Oct; Q4 report can be at 25 Jan next year
    quarter_dates = [
        (year, 4, 25, "q1"),
        (year, 7, 25, "q2"),
        (year, 10, 25, "q3"),
        (year + 1, 1, 25, "q4"),
    ]
    for y, m, d, qslug in quarter_dates:
        dt = date(y, m, d)
        # VAT
        events.append(
            _event_base(
                client_id=client_id,
                event_date=dt,
                slug=f"vat-declaration-{qslug}",
                title="VAT declaration",
                category="tax",
                description="Quarterly VAT declaration.",
                tags=["vat", "quarterly"],
            )
        )
        # 6-NDFL + RSV
        events.append(
            _event_base(
                client_id=client_id,
                event_date=dt,
                slug=f"6-ndfl-rsv-{qslug}",
                title="6-NDFL and RSV reports",
                category="report",
                description="Quarterly 6-NDFL and RSV reports.",
                tags=["6-ndfl", "rsv", "quarterly"],
            )
        )

    # yearly: accounting reports, SZV-STAZH
    szv_stazh = date(year, 3, 1)
    events.append(
        _event_base(
            client_id=client_id,
            event_date=szv_stazh,
            slug="szv-stazh",
            title="SZV-STAZH annual report",
            category="report",
            description="Annual SZV-STAZH report.",
            tags=["pension", "annual"],
        )
    )

    acc_report = date(year, 3, 31)
    events.append(
        _event_base(
            client_id=client_id,
            event_date=acc_report,
            slug="annual-accounting",
            title="Annual accounting report",
            category="report",
            description="Annual accounting report.",
            tags=["accounting", "annual"],
        )
    )

    return events


def _generate_ooo_usn_dr_tour_zp520(client_id: str, today: date) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    year = today.year

    for month in range(1, 13):
        # salary: advance and main
        adv_date = date(year, month, 5)
        main_date = date(year, month, 20)

        adv_ev = _event_base(
            client_id=client_id,
            event_date=adv_date,
            slug="salary-advance",
            title="Salary advance payment",
            category="salary",
            description="Advance salary payment.",
            tags=["salary", "monthly"],
        )
        events.append(adv_ev)

        main_ev = _event_base(
            client_id=client_id,
            event_date=main_date,
            slug="salary-main",
            title="Salary main payment",
            category="salary",
            description="Main salary payment.",
            tags=["salary", "monthly"],
        )
        events.append(main_ev)

        # ndfl next day after salary
        ndfl_adv = adv_date + timedelta(days=1)
        ndfl_main = main_date + timedelta(days=1)

        events.append(
            _event_base(
                client_id=client_id,
                event_date=ndfl_adv,
                slug="ndfl-advance",
                title="NDFL payment after advance",
                category="tax",
                description="NDFL payment for salary advance.",
                depends_on=[adv_ev["id"]],
                tags=["ndfl", "monthly"],
            )
        )
        events.append(
            _event_base(
                client_id=client_id,
                event_date=ndfl_main,
                slug="ndfl-main",
                title="NDFL payment after salary",
                category="tax",
                description="NDFL payment for main salary.",
                depends_on=[main_ev["id"]],
                tags=["ndfl", "monthly"],
            )
        )

        # insurance contributions (control around 15th)
        ins_date = date(year, month, 15)
        events.append(
            _event_base(
                client_id=client_id,
                event_date=ins_date,
                slug="insurance-control",
                title="Insurance contributions control",
                category="insurance",
                description="Control of insurance contributions for previous month.",
                tags=["insurance", "monthly"],
            )
        )

        # monthly tourist tax (report + payment) - we place on 25th
        # formally it is next month, but for test we keep same year/sequence
        tour_date = date(year, month, 25)
        events.append(
            _event_base(
                client_id=client_id,
                event_date=tour_date,
                slug="tourist-tax",
                title="Tourist tax report and payment",
                category="tax",
                description="Monthly tourist tax report and payment.",
                tags=["tourist-tax", "monthly"],
            )
        )

        # bank statement + docs
        bank_date = _first_workday(year, month)
        bank_ev = _event_base(
            client_id=client_id,
            event_date=bank_date,
            slug="bank-statement",
            title="Bank statement request",
            category="bank",
            description="Bank statement request for previous month.",
            tags=["bank", "statement", "monthly"],
        )
        events.append(bank_ev)

        docs_ev = _event_base(
            client_id=client_id,
            event_date=bank_date,
            slug="docs-request",
            title="Primary documents request",
            category="documents",
            description="Request primary documents after bank statement is received.",
            depends_on=[bank_ev["id"]],
            tags=["docs", "monthly"],
        )
        events.append(docs_ev)

    # quarterly: USN advances + 6-NDFL + RSV
    quarter_dates = [
        (year, 4, 25, "q1"),
        (year, 7, 25, "q2"),
        (year, 10, 25, "q3"),
    ]
    for y, m, d, qslug in quarter_dates:
        dt = date(y, m, d)
        events.append(
            _event_base(
                client_id=client_id,
                event_date=dt,
                slug=f"usn-advance-{qslug}",
                title="USN advance payment",
                category="tax",
                description="Quarterly USN advance payment.",
                tags=["usn", "advance", "quarterly"],
            )
        )
        events.append(
            _event_base(
                client_id=client_id,
                event_date=dt,
                slug=f"6-ndfl-rsv-{qslug}",
                title="6-NDFL and RSV reports",
                category="report",
                description="Quarterly 6-NDFL and RSV reports.",
                tags=["6-ndfl", "rsv", "quarterly"],
            )
        )

    # yearly: USN declaration and SZV-STAZH
    szv_stazh = date(year, 3, 1)
    events.append(
        _event_base(
            client_id=client_id,
            event_date=szv_stazh,
            slug="szv-stazh",
            title="SZV-STAZH annual report",
            category="report",
            description="Annual SZV-STAZH report.",
            tags=["pension", "annual"],
        )
    )

    usn_decl = date(year, 3, 31)
    events.append(
        _event_base(
            client_id=client_id,
            event_date=usn_decl,
            slug="usn-declaration",
            title="USN annual declaration",
            category="tax",
            description="Annual USN declaration.",
            tags=["usn", "annual"],
        )
    )

    return events


def _generate_default_demo(client_id: str, today: date) -> List[Dict[str, Any]]:
    """Fallback simple chain for unknown client ids."""
    events: List[Dict[str, Any]] = []
    today_date = today

    bank_ev = _event_base(
        client_id=client_id,
        event_date=today_date,
        slug="bank-statement",
        title="Bank statement request",
        category="bank",
        description="Bank statement request.",
        tags=["bank", "demo"],
        source="demo",
    )
    events.append(bank_ev)

    docs_ev = _event_base(
        client_id=client_id,
        event_date=today_date,
        slug="docs-request",
        title="Primary documents request",
        category="documents",
        description="Request primary documents after bank statement.",
        depends_on=[bank_ev["id"]],
        tags=["docs", "demo"],
        source="demo",
    )
    events.append(docs_ev)

    tax_ev = _event_base(
        client_id=client_id,
        event_date=today_date + timedelta(days=10),
        slug="tax-payment",
        title="Tax payment deadline",
        category="tax",
        description="Demo tax payment deadline.",
        depends_on=[docs_ev["id"]],
        tags=["tax", "demo"],
        source="demo",
    )
    events.append(tax_ev)

    return events


def generate_control_events_for_client(
    client_id: str, today: date | None = None
) -> List[Dict[str, Any]]:
    if today is None:
        today = date.today()

    if client_id == "ip_usn_dr":
        return _generate_ip_usn_dr(client_id=client_id, today=today)

    if client_id == "ooo_osno_3_zp1025":
        return _generate_ooo_osno_3_zp1025(client_id=client_id, today=today)

    if client_id == "ooo_usn_dr_tour_zp520":
        return _generate_ooo_usn_dr_tour_zp520(client_id=client_id, today=today)

    return _generate_default_demo(client_id=client_id, today=today)
