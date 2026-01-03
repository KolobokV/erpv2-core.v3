from fastapi import APIRouter, Query
from typing import Any, Dict, List

from app.routes_internal_tasks import list_tasks_internal

router = APIRouter(prefix="/api/coverage", tags=["coverage"])


def _is_completed(t: Dict[str, Any]) -> bool:
    s = (t.get("status") or "").lower()
    return s in ("done", "completed", "complete")


def _normalize_client_id(t: Dict[str, Any]) -> str | None:
    cid = t.get("client_id")
    if cid is None:
        cid = t.get("clientId")
    if cid is None:
        c = t.get("client")
        if isinstance(c, dict):
            cid = c.get("id") or c.get("client_id") or c.get("clientId")
    return str(cid) if cid is not None else None


@router.get("/summary")
def coverage_summary(period: str = Query("30d"), client_id: str | None = Query(None)):
    try:
        raw = list_tasks_internal()
        tasks: List[Dict[str, Any]] = []
        if isinstance(raw, list):
            for x in raw:
                if isinstance(x, dict):
                    tasks.append(x)

        if client_id:
            tasks = [t for t in tasks if (_normalize_client_id(t) == str(client_id))]

        total = len(tasks)
        covered = 0
        for t in tasks:
            if _is_completed(t):
                covered += 1
        rate = (covered / total) if total > 0 else 0.0
        return {"period": period, "coverage": rate, "coveredTasks": covered, "totalTasks": total}
    except Exception as e:
        return {
            "period": period,
            "coverage": 0.0,
            "coveredTasks": 0,
            "totalTasks": 0,
            "error": f"coverage_summary_failed:{type(e).__name__}:{str(e)[:200]}",
        }
