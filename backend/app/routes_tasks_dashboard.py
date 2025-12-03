from typing import List
from fastapi import APIRouter, Response
import csv
import io

from .tasks import load_tasks  # reuse existing storage helpers

router = APIRouter()


@router.get("/tasks/today")
def get_tasks_today():
    """
    Simplified endpoint for TasksBoard:

      GET /api/tasks/today

    For now returns *all* tasks as "today" so that UI works
    without 404. Later we can filter by due_date.
    """
    tasks = load_tasks()
    return {"items": [t.dict() for t in tasks]}


@router.get("/tasks/export")
def export_tasks_csv():
    """
    CSV export endpoint:

      GET /api/tasks/export

    Returns a basic CSV with a few common columns.
    TasksBoard only needs a successful download.
    """
    tasks = load_tasks()

    output = io.StringIO()
    writer = csv.writer(output)

    # header
    writer.writerow(["id", "title", "status", "deadline", "assignee"])

    for t in tasks:
        data = t.dict()
        writer.writerow(
            [
                data.get("id", ""),
                data.get("title") or data.get("name") or "",
                data.get("status", ""),
                data.get("due_date") or data.get("deadline") or "",
                data.get("assigned_to") or data.get("assignee") or "",
            ]
        )

    csv_data = output.getvalue()

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="tasks_export.csv"'
        },
    )
