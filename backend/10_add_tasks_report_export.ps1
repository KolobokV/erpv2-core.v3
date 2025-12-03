$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

# --- Paths ---
$root           = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir         = Join-Path $root "app"
$mainPath       = Join-Path $appDir "main.py"
$tasksExtraPath = Join-Path $appDir "tasks_extra.py"

if (!(Test-Path $appDir))   { throw "app directory not found: $appDir" }
if (!(Test-Path $mainPath)) { throw "main.py not found: $mainPath" }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# --------------------------------------------------------------------
# 1) Write app/tasks_extra.py
# --------------------------------------------------------------------
Info "Writing app/tasks_extra.py"

$py = @'
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
import httpx
import os
import csv
import io

router = APIRouter()

# Base URL for calling this backend from inside container
BACKEND_BASE = os.getenv("SELF_BASE_URL", "http://127.0.0.1:8000")


async def _get_json(path: str):
    """
    Internal HTTP client to this backend.
    path must start with '/' (e.g. '/api/tasks').
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

    # collect all keys from all items
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
'@

[System.IO.File]::WriteAllText($tasksExtraPath, $py, $utf8NoBom)
Ok "tasks_extra.py written: $tasksExtraPath"

# --------------------------------------------------------------------
# 2) Patch main.py: import + include_router
# --------------------------------------------------------------------
Info "Patching main.py"

$mainText = [System.IO.File]::ReadAllText($mainPath)

# backup
$backupMain = "$mainPath.bak_{0}" -f (Get-Date -Format "yyyyMMdd_HHmmss")
Copy-Item $mainPath $backupMain -Force
Ok "Backup created: $backupMain"

# add import if missing
if ($mainText -notlike "*from app import tasks_extra*") {
    if ($mainText -like "*from fastapi import FastAPI*") {
        $mainText = $mainText.Replace(
            "from fastapi import FastAPI",
            "from fastapi import FastAPI`r`nfrom app import tasks_extra"
        )
        Ok "Inserted 'from app import tasks_extra'"
    } else {
        $mainText = "from app import tasks_extra`r`n" + $mainText
        Warn "Could not find 'from fastapi import FastAPI', import added at top"
    }
}

# add include_router if missing
if ($mainText -notlike "*app.include_router(tasks_extra.router)*") {
    $mainText = $mainText + "`r`n`r`napp.include_router(tasks_extra.router)`r`n"
    Ok "Inserted app.include_router(tasks_extra.router)"
}

[System.IO.File]::WriteAllText($mainPath, $mainText, $utf8NoBom)
Ok "main.py updated"

# --------------------------------------------------------------------
# 3) Rebuild & restart container
# --------------------------------------------------------------------
Push-Location $root
try {
    Info "docker compose build"
    docker compose build | Out-Null
    Ok "docker compose build OK"

    Info "docker compose up -d"
    docker compose up -d | Out-Null
    Ok "docker compose up -d OK"
}
finally {
    Pop-Location
}

Start-Sleep 3

# --------------------------------------------------------------------
# 4) Quick HTTP smoke on localhost:8000
# --------------------------------------------------------------------
function Hit([string]$url){
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
        return "[{0}] len={1}" -f [int]$r.StatusCode, $r.Content.Length
    } catch {
        return "ERROR: $($_.Exception.Message)"
    }
}

Info "HTTP smoke on http://localhost:8000"
"HEALTH                  => $(Hit 'http://localhost:8000/health')"
"CONFIG                  => $(Hit 'http://localhost:8000/config')"
"CLIENTS                 => $(Hit 'http://localhost:8000/clients')"
"INVOICES                => $(Hit 'http://localhost:8000/invoices')"
"PRODUCTS                => $(Hit 'http://localhost:8000/products')"
"TASKS                   => $(Hit 'http://localhost:8000/api/tasks')"
"TASKS_TODAY             => $(Hit 'http://localhost:8000/api/tasks/today')"
"REPORT_TODAY_BY_ASSIGNEE=> $(Hit 'http://localhost:8000/api/tasks/report/today_by_assignee')"
"EXPORT                  => $(Hit 'http://localhost:8000/api/tasks/export')"

Ok "Done"
