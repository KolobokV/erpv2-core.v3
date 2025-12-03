param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Backend root: $root"

$appDir   = Join-Path $root "app"
$mainPath = Join-Path $appDir "main.py"

if (-not (Test-Path $mainPath)) {
    throw "main.py not found at $mainPath"
}

# Backup current main.py
$backup = "$mainPath.bak_$(Get-Date -Format yyyyMMdd_HHmmss)"
Copy-Item $mainPath $backup -Force
Write-Host "[OK] Backup created: $backup"

# New main.py content (UTF-8 without BOM)
$py = @'
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import doliproxy, tasks_extra, stats

app = FastAPI(title="ERPv2 backend connect")

# CORS so that front on localhost can call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers with Dolibarr proxy, extra task reports and stats
app.include_router(doliproxy.router)
app.include_router(tasks_extra.router)
app.include_router(stats.router)


# ---- Simple built-in endpoints ----

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/config")
async def config():
    # Minimal config used by front and smoke scripts
    return {
        "backend_base": "http://host.docker.internal:8000",
        "dolibarr_base": "http://host.docker.internal:8282",
    }


# Basic task endpoints for front dashboards

@app.get("/api/tasks")
async def tasks_all():
    # For now return empty list
    return []


@app.get("/api/tasks/today")
async def tasks_today():
    # For now return empty list
    return []


@app.api_route("/api/tasks/{task_id}/status", methods=["GET", "POST"])
async def task_status(task_id: int):
    # Stub status endpoint
    return {"id": task_id, "status": "unknown"}
'@

$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($mainPath, $py, $encoding)
Write-Host "[OK] main.py overwritten"

Write-Host "[INFO] docker compose build"
docker compose build

Write-Host "[INFO] docker compose up -d"
docker compose up -d

Start-Sleep -Seconds 5

function Test-Endpoint($url, $name) {
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
        Write-Host "[OK] $name => $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] $name => $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Test-Endpoint "http://localhost:8000/health" "HEALTH"
Test-Endpoint "http://localhost:8000/config" "CONFIG"
Test-Endpoint "http://localhost:8000/clients" "CLIENTS"
Test-Endpoint "http://localhost:8000/invoices" "INVOICES"
Test-Endpoint "http://localhost:8000/products" "PRODUCTS"
Test-Endpoint "http://localhost:8000/api/tasks" "TASKS"
Test-Endpoint "http://localhost:8000/api/tasks/today" "TASKS_TODAY"
Test-Endpoint "http://localhost:8000/stats" "STATS"
