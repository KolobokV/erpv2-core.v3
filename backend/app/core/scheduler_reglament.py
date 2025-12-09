import logging
import threading
import time
from datetime import datetime, timezone
from typing import Dict

from app.core.events import EventTypes, get_event_system

logger = logging.getLogger(__name__)

# Registry of reglament chains.
REGLEMENT_CHAINS = [
    {
        "chain_id": "reglament.ip_usn_dr.monthly",
        "client_id": "ip_usn_dr",
    },
    {
        "chain_id": "reglament.ooo_osno_3_zp1025.monthly",
        "client_id": "ooo_osno_3_zp1025",
    },
    {
        "chain_id": "reglament.ooo_usn_dr_tour.monthly",
        "client_id": "ooo_usn_dr_tour",
    },
]

_scheduler_started = False
_fired = set()
_fired_lock = threading.Lock()


def _current_period() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


async def _publish_chain_event(chain: Dict[str, str], period: str):
    """
    Publish CHAIN_TRIGGERED event for a single chain.
    """
    es = get_event_system()

    payload = {
        "chain_id": chain["chain_id"],
        "client_id": chain["client_id"],
        "period": period,
        "mode": "reglament",
        "trigger": "scheduler",
    }

    logger.info(
        "REGLEMENT_SCHEDULER: publishing CHAIN_TRIGGERED -> %s",
        payload,
    )

    await es.publish(EventTypes.CHAIN_TRIGGERED, payload)


def _fire_period(period: str):
    """
    Fire CHAIN_TRIGGERED events for all chains only once per period.
    """
    global _fired

    for chain in REGLEMENT_CHAINS:
        key = f"{chain['chain_id']}::{period}"

        with _fired_lock:
            if key in _fired:
                continue
            _fired.add(key)

        # schedule async publish (EventSystem is async)
        import asyncio

        asyncio.run(_publish_chain_event(chain, period))


def _scheduler_loop():
    """
    Runs in background thread:
      - fires events once on start
      - every 5 minutes checks and fires new period
    """
    logger.info("REGLEMENT_SCHEDULER_LOOP_START")

    try:
        period = _current_period()
        _fire_period(period)
    except Exception as exc:
        logger.warning("REGLEMENT_SCHEDULER_INITIAL_FIRE_FAILED: %s", exc)

    while True:
        time.sleep(300.0)
        try:
            period = _current_period()
            _fire_period(period)
        except Exception as exc:
            logger.warning("REGLEMENT_SCHEDULER_TICK_FAILED: %s", exc)


def start_reglament_scheduler():
    """
    Start the background scheduler (idempotent).
    """
    global _scheduler_started

    if _scheduler_started:
        return
    _scheduler_started = True

    thread = threading.Thread(
        target=_scheduler_loop,
        name="reglament-scheduler",
        daemon=True,
    )
    thread.start()

    logger.info("REGLEMENT_SCHEDULER_STARTED")
