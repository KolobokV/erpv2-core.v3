from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Set

from app.core.events import EventTypes, get_event_system

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReglamentChainConfig:
    chain_id: str
    client_id: str


# Demo mapping: one chain per client profile.
REGLEMENT_CHAINS: List[ReglamentChainConfig] = [
    ReglamentChainConfig(
        chain_id="reglament.ip_usn_dr.monthly",
        client_id="ip_usn_dr",
    ),
    ReglamentChainConfig(
        chain_id="reglament.ooo_osno_3_zp1025.monthly",
        client_id="ooo_osno_3_zp1025",
    ),
    ReglamentChainConfig(
        chain_id="reglament.ooo_usn_dr_tour_zp520.monthly",
        client_id="ooo_usn_dr_tour_zp520",
    ),
]


_scheduler_started = False
_fired_keys_lock = threading.Lock()
_fired_keys: Set[str] = set()


def _current_period() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


def _make_fired_key(chain_id: str, period: str) -> str:
    return f"{chain_id}::{period}"


def _fire_chains_for_period(period: str) -> None:
    """
    For each configured reglement chain, publish a CHAIN_TRIGGERED event
    for the given period if it was not fired before in this process.
    """
    global _fired_keys

    es = get_event_system()

    for cfg in REGLEMENT_CHAINS:
        key = _make_fired_key(cfg.chain_id, period)

        with _fired_keys_lock:
            if key in _fired_keys:
                continue
            _fired_keys.add(key)

        context = {
            "process_instance_id": "",
            "process_definition_id": "",
            "process_name": cfg.chain_id,
            "month": period,
            "client_id": cfg.client_id,
            "status": "scheduled",
        }

        logger.info(
            "REGLEMENT_SCHEDULER_FIRE: chain_id=%s client_id=%s period=%s",
            cfg.chain_id,
            cfg.client_id,
            period,
        )

        es.publish(
            EventTypes.CHAIN_TRIGGERED,
            {
                "chain_id": cfg.chain_id,
                "client_id": cfg.client_id,
                "context": context,
            },
        )


def _scheduler_loop() -> None:
    """
    Background loop that triggers reglement chains once per period (YYYY-MM).

    Strategy:
      - On start: fire chains for current period once.
      - Then every 5 minutes:
          - recompute current period,
          - fire chains for this period if not fired before.
    """
    logger.info("REGLEMENT_SCHEDULER_LOOP_START")

    try:
        period = _current_period()
        _fire_chains_for_period(period)
    except Exception as exc:
        logger.warning("REGLEMENT_SCHEDULER_INITIAL_FIRE_FAILED: %s", exc)

    while True:
        time.sleep(300.0)
        try:
            period = _current_period()
            _fire_chains_for_period(period)
        except Exception as exc:
            logger.warning("REGLEMENT_SCHEDULER_TICK_FAILED: %s", exc)


def start_reglament_scheduler() -> None:
    """
    Idempotent entry point to start background reglement scheduler.
    """
    global _scheduler_started

    if _scheduler_started:
        logger.debug("REGLEMENT_SCHEDULER_ALREADY_STARTED")
        return

    _scheduler_started = True

    thread = threading.Thread(
        target=_scheduler_loop,
        name="reglament-scheduler",
        daemon=True,
    )
    thread.start()

    logger.info("REGLEMENT_SCHEDULER_STARTED")
