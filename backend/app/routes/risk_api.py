from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from app.routes_internal_tasks import list_tasks_internal

router = APIRouter(prefix="/api/risk", tags=["risk"])


def _as_dt(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, (int, float)):
        try:
            return datetime.fromtimestamp(float(v), tz=timezone.utc)
        except Exception:
            return None
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None
    return None


def _normalize_task(t: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(t)

    cid = out.get("client_id", None)
    if cid is None:
        cid = out.get("clientId", None)
    if cid is None:
        c = out.get("client", None)
        if isinstance(c, dict):
            cid = c.get("id") or c.get("client_id") or c.get("clientId")
    out["client_id"] = cid

    st = out.get("status") or out.get("state") or ""
    out["status"] = str(st).lower()

    dl = out.get("deadline", None)
    if dl is None:
        dl = out.get("due", None)
    if dl is None:
        dl = out.get("due_date", None)
    if dl is None:
        dl = out.get("dueDate", None)
    out["deadline"] = dl

    return out


def _is_completed(task: Dict[str, Any]) -> bool:
    s = (task.get("status") or "").lower()
    return s in ("done", "completed", "complete")


def _calc_simple_risk(tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    overdue = 0
    due_soon = 0
    total = 0
    missing_client = 0

    for t in tasks:
        if not isinstance(t, dict):
            continue
        total += 1
        if t.get("client_id") is None:
            missing_client += 1

        if _is_completed(t):
            continue

        dt = _as_dt(t.get("deadline"))
        if dt is None:
            continue

        if dt < now:
            overdue += 1
        else:
            if (dt - now).total_seconds() <= 7 * 24 * 3600:
                due_soon += 1

    score = min(100, overdue * 10 + due_soon * 3 + (5 if missing_client > 0 else 0))

    reasons: List[str] = []
    if overdue > 0:
        reasons.append("overdue")
    if due_soon > 0:
        reasons.append("due_soon")
    if missing_client > 0:
        reasons.append("missing_client_id")

    return {
        "score": score,
        "totalTasks": total,
        "overdueTasks": overdue,
        "dueSoonTasks": due_soon,
        "topReasons": reasons[:6],
    }


@router.get("/summary")
def risk_summary(client_id: str | None = Query(None)):
    try:
        raw = list_tasks_internal()
        tasks: List[Dict[str, Any]] = []
        if isinstance(raw, list):
            for x in raw:
                if isinstance(x, dict):
                    tasks.append(_normalize_task(x))

        if client_id:
            tasks = [t for t in tasks if str(t.get("client_id") or "") == str(client_id)]

        try:
            from app.services.risk_service import calculate_risks

            result = calculate_risks(tasks)
            if result is None:
                out = _calc_simple_risk(tasks)
                out["error"] = "risk_service_returned_none"
                return out
            if isinstance(result, dict):
                result.setdefault("score", result.get("riskScore") or result.get("risk_score") or 0)
                result.setdefault("totalTasks", result.get("totalTasks") or result.get("total") or 0)
                result.setdefault("overdueTasks", result.get("overdueTasks") or result.get("overdue") or 0)
                result.setdefault("dueSoonTasks", result.get("dueSoonTasks") or result.get("dueSoon") or 0)
                result.setdefault("topReasons", result.get("topReasons") or result.get("reasons") or [])
                return result
            out = _calc_simple_risk(tasks)
            out["error"] = "risk_service_returned_non_dict"
            return out
        except Exception as e2:
            out = _calc_simple_risk(tasks)
            out["error"] = f"risk_service_failed:{type(e2).__name__}:{str(e2)[:200]}"
            return out
    except Exception as e:
        return {
            "score": 0,
            "totalTasks": 0,
            "overdueTasks": 0,
            "dueSoonTasks": 0,
            "topReasons": [],
            "error": f"risk_summary_failed:{type(e).__name__}:{str(e)[:200]}",
        }
