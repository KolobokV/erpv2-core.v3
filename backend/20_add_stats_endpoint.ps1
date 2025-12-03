# 20_add_stats_endpoint.ps1
# UTF-8, no BOM

Param()

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$App = Join-Path $Root "app"
$StatsPy = Join-Path $App "stats.py"
$MainPy  = Join-Path $App "main.py"

Write-Host "== Adding /stats endpoint =="

# ---------------------------
# Write app/stats.py
# ---------------------------
$statsCode = @'
from fastapi import APIRouter
import os
import urllib.request
import json

router = APIRouter()

def fetch_json(url: str):
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))
    except:
        return None

@router.get("/stats")
def get_stats():
    base = os.getenv("DOLI_API_URL") or "http://host.docker.internal:8282/api/index.php"
    key  = os.getenv("DOLI_API_KEY") or ""

    def make(url):
        return f"{base.rstrip('/')}/{url}?DOLAPIKEY={key}"

    clients  = fetch_json(make("thirdparties")) or []
    products = fetch_json(make("products")) or []
    invoices = fetch_json(make("invoices")) or []

    # tasks
    tasks_today = fetch_json("http://localhost:8000/api/tasks/today") or []
    tasks_all   = fetch_json("http://localhost:8000/api/tasks") or []

    # invoice sum (month)
    total_month = 0
    for inv in invoices:
        amount = inv.get("total", 0)
        if isinstance(amount, (int, float)):
            total_month += amount

    overdue = sum(1 for t in tasks_all if t.get("status", 0) != 1)

    return {
        "total_clients": len(clients),
        "total_products": len(products),
        "total_invoices": len(invoices),
        "invoices_sum_month": total_month,
        "tasks_total": len(tasks_all),
        "tasks_today": len(tasks_today),
        "tasks_overdue": overdue
    }
'@

Set-Content -Path $StatsPy -Value $statsCode -Encoding UTF8
Write-Host "[OK] stats.py written: $StatsPy"

# ---------------------------
# Patch main.py
# ---------------------------
$mainText = Get-Content $MainPy -Raw

if ($mainText -notlike "*from app import stats*") {
    $mainText = "from app import stats`r`n" + $mainText
    Write-Host "[OK] Inserted import stats"
}

if ($mainText -notlike "*app.include_router(stats.router)*") {
    $mainText += "`r`napp.include_router(stats.router)"
    Write-Host "[OK] Inserted app.include_router(stats.router)"
}

$Backup = "$MainPy.bak_$(Get-Date -Format yyyyMMdd_HHmmss)"
Copy-Item $MainPy $Backup
Write-Host "[OK] Backup created: $Backup"

Set-Content -Path $MainPy -Value $mainText -Encoding UTF8
Write-Host "[OK] main.py updated"

# ---------------------------
# Rebuild backend
# ---------------------------
Write-Host "== docker compose build =="
docker compose build

Write-Host "== docker compose up -d =="
docker compose up -d

Start-Sleep -Seconds 3

# ---------------------------
# Test /stats
# ---------------------------
Write-Host "== Testing /stats =="
try {
    $r = Invoke-WebRequest "http://localhost:8000/stats" -UseBasicParsing -TimeoutSec 10
    Write-Host "[OK] /stats =>" $r.StatusCode
    Write-Output $r.Content
} catch {
    Write-Host "[ERR] Failed:" $_.Exception.Message
}

Write-Host "== Done =="
