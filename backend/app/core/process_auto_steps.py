from __future__ import annotations

from typing import Dict, List


# Mapping between control event code and default process steps.
# This is a configuration layer and can be safely extended later.
AUTO_STEPS_BY_EVENT_CODE: Dict[str, List[str]] = {
    # ip_usn_dr
    "request_bank_statements": [
        "Prepare email template",
        "Send request to client",
        "Wait for bank statements",
        "Verify bank statements",
    ],
    "request_documents": [
        "Prepare document checklist",
        "Send request to client",
        "Wait for documents",
        "Check received documents",
    ],
    "monthly_close": [
        "Collect primary documents",
        "Prepare draft reports",
        "Review calculations",
        "Finalize reports",
        "Send reports to client",
    ],
    # ooo_osno_3_zp1025
    "payroll_advance": [
        "Prepare advance payroll",
        "Send payroll for approval",
        "Process advance payments",
        "Archive payroll documents",
    ],
    "payroll_main": [
        "Prepare main payroll",
        "Send payroll for approval",
        "Process salary payments",
        "Report to funds",
        "Archive payroll documents",
    ],
    # ooo_usn_dr_tour_zp520
    "tourist_tax": [
        "Check tourist data",
        "Prepare tourist tax declaration",
        "Submit tourist tax declaration",
        "Archive declaration and confirmations",
    ],
}


def get_auto_steps_for_event(event_code: str) -> List[str]:
    """
    Return a configured list of step titles for a given event code.

    The result is a copy of the internal list so caller can modify it safely.
    """
    if not event_code:
        return []
    return AUTO_STEPS_BY_EVENT_CODE.get(event_code, []).copy()
