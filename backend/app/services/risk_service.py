from datetime import datetime, timedelta
from typing import List, Dict

def calculate_risks(tasks: List[Dict]) -> List[Dict]:
    now = datetime.utcnow()
    risks = []

    by_client = {}
    for t in tasks:
        by_client.setdefault(t["client_id"], []).append(t)

    for client_id, client_tasks in by_client.items():
        overdue = [
            t for t in client_tasks
            if t["status"] != "completed" and t["deadline"] < now
        ]
        if overdue:
            risks.append({
                "client_id": client_id,
                "type": "overdue_task",
                "severity": "high",
                "reason": "Has overdue tasks",
                "task_ids": [t["id"] for t in overdue],
            })

        soon = [
            t for t in client_tasks
            if t["status"] != "completed"
            and now <= t["deadline"] <= now + timedelta(days=3)
        ]
        if soon:
            risks.append({
                "client_id": client_id,
                "type": "deadline_soon",
                "severity": "medium",
                "reason": "Deadlines approaching",
                "task_ids": [t["id"] for t in soon],
            })

        stale = [
            t for t in client_tasks
            if t["status"] != "completed"
            and (now - t["updated_at"]).days >= 5
        ]
        if stale:
            risks.append({
                "client_id": client_id,
                "type": "stale_tasks",
                "severity": "medium",
                "reason": "Tasks not updated for long time",
                "task_ids": [t["id"] for t in stale],
            })

        if len([t for t in client_tasks if t["status"] != "completed"]) > 10:
            risks.append({
                "client_id": client_id,
                "type": "task_cluster_overload",
                "severity": "low",
                "reason": "Too many active tasks",
                "task_ids": [t["id"] for t in client_tasks],
            })

    return risks