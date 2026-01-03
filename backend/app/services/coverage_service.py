from typing import List, Dict

def calculate_coverage(tasks: List[Dict], period: str) -> List[Dict]:
    by_client = {}
    for t in tasks:
        by_client.setdefault(t["client_id"], []).append(t)

    result = []
    for client_id, client_tasks in by_client.items():
        total = len(client_tasks)
        completed = len([t for t in client_tasks if t["status"] == "completed"])
        overdue = len([t for t in client_tasks if t["status"] != "completed"])

        coverage = int((completed / total) * 100) if total else 0

        result.append({
            "client_id": client_id,
            "period": period,
            "expected_tasks_count": total,
            "completed_tasks_count": completed,
            "overdue_tasks_count": overdue,
            "coverage_percent": coverage,
        })

    return result