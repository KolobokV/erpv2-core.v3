Param(
  [string]$BackendRoot = "C:\Users\User\Desktop\ERP\ERPv2_backend_connect",
  [string]$BackendUrl  = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"
Set-Location $BackendRoot

Write-Host "== Normalize requirements and rebuild ==" -ForegroundColor Cyan

# 1) Перезаписываем requirements.txt единым консистентным набором (без дублей версий)
$reqPath = Join-Path $BackendRoot "requirements.txt"
@"
fastapi==0.115.4
uvicorn[standard]==0.32.0
requests==2.32.3
pydantic==2.9.2
SQLAlchemy==2.0.30
httpx==0.27.0
"@ | Set-Content -LiteralPath $reqPath -Encoding UTF8
Write-Host "requirements.txt normalized." -ForegroundColor Green

# 2) Контроль включения роутера задач в app\main.py (идемпотентно)
$main = Join-Path $BackendRoot "app\main.py"
if (-not (Test-Path $main)) { throw "main.py not found at $main. Apply Stage1 first." }
$txt = Get-Content -LiteralPath $main -Raw
$changed = $false
if ($txt -notmatch "from \.tasks import router as tasks_router") {
  $txt += "`r`nfrom .tasks import router as tasks_router"
  $changed = $true
}
if ($txt -notmatch "app\.include_router\(tasks_router\)") {
  $txt += "`r`napp.include_router(tasks_router)`r`n"
  $changed = $true
}
if ($changed) {
  Set-Content -LiteralPath $main -Value $txt -Encoding UTF8
  Write-Host "Patched main.py: tasks router included." -ForegroundColor Yellow
} else {
  Write-Host "main.py already includes tasks router." -ForegroundColor Gray
}

# 3) Жёсткая пересборка без кэша + запуск
Write-Host "Building image (no cache)..." -ForegroundColor Yellow
docker compose build --no-cache
Write-Host "Starting containers..." -ForegroundColor Yellow
docker compose up -d

# 4) Проверка OpenAPI путей
Start-Sleep -Seconds 3
try {
  $paths = (Invoke-RestMethod ($BackendUrl.TrimEnd('/') + "/openapi.json")).paths.PSObject.Properties.Name
  Write-Host "OpenAPI paths:" -ForegroundColor Cyan
  $paths | ForEach-Object { Write-Host (" - {0}" -f $_) }
} catch {
  Write-Host ("⚠ Failed to fetch openapi.json: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
}

Write-Host "== Done ==" -ForegroundColor Cyan
