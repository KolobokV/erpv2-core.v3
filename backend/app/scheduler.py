from datetime import datetime
from .internal_processes_store import create_monthly_instances_if_absent


def run_monthly_scheduler():
    """
    This function is triggered manually or (in future) by cron-like logic.
    It ensures monthly instances exist.
    """
    result = create_monthly_instances_if_absent()
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "result": result,
    }
