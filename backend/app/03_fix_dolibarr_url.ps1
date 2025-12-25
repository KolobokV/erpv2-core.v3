# 03_fix_dolibarr_url.ps1
# Фиксирует URL Dolibarr для бэкенда так, чтобы он ходил на host.docker.internal:8282
# и сразу делает смоук-тест критичных ручек.

param(
    [string]$ProjectRoot = $(Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

Info "Project root: $ProjectRoot"

# 1) .env
$envPath = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envPath)) {
    Fail ".env not found: $envPath"
    throw ".env not found: $envPath"
}

Info "Reading .env"
$lines = Get-Content $envPath

$targetLine = 'DOLI_API_URL=http://host.docker.internal:8282/api/index.php'

if ($lines -match '^DOLI_API_URL=') {
    Info "Updating existing DOLI_API_URL в .env"
    $lines = $lines -replace '^DOLI_API_URL=.*$', $targetLine
} else {
    Info "Adding DOLI_API_URL в .env"
    $lines += $targetLine
}

# Записываем без BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($envPath, $lines, $utf8NoBom)
Ok ".env updated with DOLI_API_URL"

# 2) Перезапускаем бэкенд
Info "Restarting backend via docker compose up -d"
Push-Location $ProjectRoot
try {
    docker compose up -d | Out-Null
} finally {
    Pop-Location
}
Ok "Backend restarted"

# 3) Быстрый смоук /health и /health/dolibarr
function Hit($url){
    try{
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
        return "[200] len=" + ($r.Content.Length)
    } catch {
        $msg = $_.Exception.Message
        if ($_.Exception.Response -ne $null) {
            $code = [int]$_.Exception.Response.StatusCode
            return "[$code] $msg"
        }
        return "[ERR] $msg"
    }
}

Start-Sleep 2

Info "HTTP smoke"
Ok ("HEALTH          => {0}" -f (Hit "http://localhost:8000/health"))
Ok ("HEALTH/DOLIBARR => {0}" -f (Hit "http://localhost:8000/health/dolibarr"))
Ok ("CLIENTS         => {0}" -f (Hit "http://localhost:8000/clients"))
Ok ("INVOICES        => {0}" -f (Hit "http://localhost:8000/invoices"))
Ok ("PRODUCTS        => {0}" -f (Hit "http://localhost:8000/products"))
