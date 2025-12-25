import asyncio
import datetime
import logging
from typing import Optional

from app.services.chain_executor_v2 import run_reglament_for_period

logger = logging.getLogger(__name__)

# Registry of reglament chains for UI / dev API
REGLEMENT_CHAINS = {
    "monthly_reglament": {
        "code": "monthly_reglament",
        "description": "Monthly reglament for all clients based on client profiles and step templates",
        "schedule": "0 9 1 * *",  # cron like: 09:00 at first day of month
    }
}

_scheduler_task: Optional[asyncio.Task] = None


def start_reglament_scheduler() -> None:
    """
    Lightweight scheduler:
    - runs background loop
    - every 60 seconds checks current datetime
    - on first day of month at 09:00 triggers reglament for previous month
    """
    global _scheduler_task

    if _scheduler_task is not None:
        logger.info("Reglament scheduler already running")
        return

    async def _worker() -> None:
        logger.info("Reglament scheduler started")
        while True:
            now = datetime.datetime.now()
            try:
                year = now.year
                month = now.month - 1
                if month == 0:
                    month = 12
                    year -= 1

                if now.day == 1 and now.hour == 9 and now.minute == 0:
                    logger.info("Scheduler triggering reglament for %04d-%02d", year, month)
                    await run_reglament_for_period(year=year, month=month)
            except Exception as exc:
                logger.exception("Error in reglament scheduler: %s", exc)
            await asyncio.sleep(60)

    loop = asyncio.get_event_loop()
    _scheduler_task = loop.create_task(_worker())
