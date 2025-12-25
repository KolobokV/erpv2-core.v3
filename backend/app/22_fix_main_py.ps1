param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Backend root: $root"

$appDir  = Join-Path $root "app"
$mainPath = Join-Path $appDir "main.py"

if (-not (Test-Path $mainPath)) {
    throw "main.py not found at $mainPath"
}

# Backup
$backup = "$mainPath.bak_$(Get-Date -Format yyyyMMdd_HHmmss)"
Copy-Item $mainPath $backup -Force
Write-Host "[OK] Backup created: $backup"

# New main.py
$py = @'
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import doliproxy, tasks_extra, stats

app = FastAPI(title="ERPv2 backend connect")

# CORS for front on localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(doliproxy.router)
app.include_router(tasks_extra.router)
app.include_router(stats.router)
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
Test-Endpoint "http://localhost:8000/stats" "STATS"
