from __future__ import annotations

import csv
import io
import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

router = APIRouter()

# Base URL for calling this backend from inside container
BACKEND_BASE = os.getenv("SELF_BASE_URL", "http://127.0.0.1:8000")


async def _get_json(path: str):
    """
    Internal HTTP client to this backend.
    Path must start with '/' (e.g. '/api/tasks').
    """
    url = BACKEND_BASE.rstrip("/") + path
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
    resp.raise_for_status()
    return resp.json()


@router.get("/api/tasks/report/today_by_assignee")
async def tasks_report_today_by_assignee():
    """
    Build simple report: number of tasks per assignee.
    Try /api/tasks/today first, then /api/tasks.

    Response format:
    { "items": [ {"assignee": "...", "tasks_count": N}, ... ] }
    """
    try:
        tasks = await _get_json("/api/tasks/today")
    except httpx.HTTPError:
        tasks = await _get_json("/api/tasks")

    if not isinstance(tasks, list):
        raise HTTPException(status_code=502, detail="Unexpected tasks format")

    summary = {}
    for t in tasks:
        assignee = (
            t.get("assignee")
            or t.get("assigned_to")
            or t.get("user")
            or t.get("owner")
            or t.get("responsible")
            or "unassigned"
        )
        summary[assignee] = summary.get(assignee, 0) + 1

    items = [{"assignee": k, "tasks_count": v} for k, v in summary.items()]
    return {"items": items}


@router.get("/api/tasks/export", response_class=PlainTextResponse)
async def tasks_export():
    """
    Export tasks to CSV using /api/tasks JSON.
    """
    tasks = await _get_json("/api/tasks")

    if not isinstance(tasks, list):
        raise HTTPException(status_code=502, detail="Unexpected tasks format")

    if not tasks:
        headers = ["id", "title", "assignee", "status"]
        text = ",".join(headers) + "\n"
        return PlainTextResponse(
            content=text,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="tasks.csv"'},
        )

    # Collect all keys from all items
    keys = sorted({k for item in tasks for k in item.keys()})

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(keys)

    for item in tasks:
        row = [item.get(k, "") for k in keys]
        writer.writerow(row)

    csv_text = buf.getvalue()
    buf.close()

    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="tasks.csv"'},
    )
