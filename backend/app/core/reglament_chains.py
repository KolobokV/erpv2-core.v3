from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from .chain_registry import register_chain
from .control_event_adapter import create_control_event_from_chain
from .internal_process_adapter import trigger_generate_tasks_from_chain

logger = logging.getLogger(__name__)


def _extract_period(context: Dict[str, Any]) -> str:
    """
    Extract period string from context.

    Expected keys:
      - "month" (preferred, e.g. "2025-12")
      - fallback: "period"
    """
    raw_month = context.get("month") or context.get("period") or ""
    try:
        return str(raw_month)
    except Exception:
        return ""


def _extract_instance_id(context: Dict[str, Any]) -> str:
    """
    Extract process_instance_id from context if present.
    """
    raw = context.get("process_instance_id") or ""
    try:
        return str(raw).strip()
    except Exception:
        return ""


def _maybe_trigger_tasks_for_instance(
    *,
    chain_id: str,
    profile_code: str,
    client_id: Optional[str],
    context: Dict[str, Any],
) -> None:
    """
    Step B1:
      - If context contains process_instance_id, call generate-tasks for this instance.
      - If not, do nothing (only log).
    """
    instance_id = _extract_instance_id(context)
    if not instance_id:
        logger.debug(
            "Reglament chain %s: no process_instance_id in context, "
            "skipping generate-tasks bridge",
            chain_id,
        )
        return

    payload: Dict[str, Any] = {
        **context,
        "chain_id": chain_id,
        "profile_code": profile_code,
    }

    trigger_generate_tasks_from_chain(
        process_instance_id=instance_id,
        payload=payload,
    )


async def _chain_ip_usn_dr_monthly(
    client_id: Optional[str],
    context: Dict[str, Any],
) -> None:
    """
    Reglament chain for IP USN income minus expenses (monthly).

    Step A: emit a control-event request through the adapter.
    Step B1: if process_instance_id is present, trigger generate-tasks for this instance.
    """
    chain_id = "reglament.ip_usn_dr.monthly"
    profile_code = "ip_usn_dr"

    logger.info(
        "Reglament chain %s triggered for client_id=%s with context=%s",
        chain_id,
        client_id,
        context,
    )

    period = _extract_period(context)
    payload = {
        **context,
        "chain_id": chain_id,
    }

    create_control_event_from_chain(
        client_id=client_id,
        profile_code=profile_code,
        period=period,
        event_code="monthly_reglament",
        payload=payload,
    )

    _maybe_trigger_tasks_for_instance(
        chain_id=chain_id,
        profile_code=profile_code,
        client_id=client_id,
        context=context,
    )


async def _chain_ooo_osno_3_zp1025_monthly(
    client_id: Optional[str],
    context: Dict[str, Any],
) -> None:
    """
    Reglament chain for LLC on general tax system
    with salary on 10th and 25th.
    """
    chain_id = "reglament.ooo_osno_3_zp1025.monthly"
    profile_code = "ooo_osno_3_zp1025"

    logger.info(
        "Reglament chain %s triggered for client_id=%s with context=%s",
        chain_id,
        client_id,
        context,
    )

    period = _extract_period(context)
    payload = {
        **context,
        "chain_id": chain_id,
    }

    create_control_event_from_chain(
        client_id=client_id,
        profile_code=profile_code,
        period=period,
        event_code="monthly_reglament",
        payload=payload,
    )

    _maybe_trigger_tasks_for_instance(
        chain_id=chain_id,
        profile_code=profile_code,
        client_id=client_id,
        context=context,
    )


async def _chain_ooo_usn_dr_tour_zp520_monthly(
    client_id: Optional[str],
    context: Dict[str, Any],
) -> None:
    """
    Reglament chain for LLC on USN income minus expenses with tourist tax
    and salary on 5th and 20th.
    """
    chain_id = "reglament.ooo_usn_dr_tour_zp520.monthly"
    profile_code = "ooo_usn_dr_tour_zp520"

    logger.info(
        "Reglament chain %s triggered for client_id=%s with context=%s",
        chain_id,
        client_id,
        context,
    )

    period = _extract_period(context)
    payload = {
        **context,
        "chain_id": chain_id,
    }

    create_control_event_from_chain(
        client_id=client_id,
        profile_code=profile_code,
        period=period,
        event_code="monthly_reglament",
        payload=payload,
    )

    _maybe_trigger_tasks_for_instance(
        chain_id=chain_id,
        profile_code=profile_code,
        client_id=client_id,
        context=context,
    )


def register_reglament_chains() -> None:
    """
    Register all reglament chains in the registry.
    """
    register_chain("reglament.ip_usn_dr.monthly", _chain_ip_usn_dr_monthly)
    register_chain(
        "reglament.ooo_osno_3_zp1025.monthly",
        _chain_ooo_osno_3_zp1025_monthly,
    )
    register_chain(
        "reglament.ooo_usn_dr_tour_zp520.monthly",
        _chain_ooo_usn_dr_tour_zp520_monthly,
    )
    logger.info("Reglament chains registered")


# Self-registration on import:
try:
    register_reglament_chains()
except Exception as exc:
    logger.warning("Failed to register reglament chains on import: %s", exc)
