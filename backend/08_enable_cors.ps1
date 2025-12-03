# 08_enable_cors.ps1
# Enable CORS in FastAPI backend so front (localhost:5175) can call API directly

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }

# Project root (folder with app/, docker-compose.yml, etc.)
$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

$mainPath = Join-Path $root "app\main.py"
if (!(Test-Path $mainPath)) {
    throw "main.py not found: $mainPath"
}

Info "Patching main.py for CORS support"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$text = [System.IO.File]::ReadAllText($mainPath)

# 1) Добавляем импорт CORSMiddleware, если его нет
if ($text -notmatch "CORSMiddleware") {
    if ($text -notmatch "from fastapi import FastAPI") {
        throw "Cannot find line 'from fastapi import FastAPI' in main.py"
    }

    $text = $text -replace "from fastapi import FastAPI",
        "from fastapi import FastAPI`nfrom fastapi.middleware.cors import CORSMiddleware"
} else {
    Warn "CORSMiddleware import already present (ok)"
}

# 2) Вставляем app.add_middleware(...) после 'app = FastAPI(...)' с ЛЮБЫМИ аргументами
$patternApp = "app\s*=\s*FastAPI\([^)]*\)"
if (-not [regex]::IsMatch($text, $patternApp)) {
    throw "Cannot find 'app = FastAPI(...)' in main.py"
}

if ($text -match "app\.add_middleware\(\s*CORSMiddleware") {
    Warn "CORS middleware already configured in main.py (nothing to inject)"
} else {
    $corsBlock = @'
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
'@

    $replacement = '$0' + "`r`n`r`n" + $corsBlock
    $text = [regex]::Replace($text, $patternApp, $replacement, 1)

    $backup = "$mainPath.bak_$(Get-Date -Format yyyyMMdd_HHmmss)"
    Copy-Item $mainPath $backup -Force
    [System.IO.File]::WriteAllText($mainPath, $text, $utf8NoBom)
    Ok "main.py patched for CORS (backup: $backup)"
}

# 3) Rebuild and restart backend
Push-Location $root
try {
    Info "docker compose build"
    docker compose build | Out-Null

    Info "docker compose up -d"
    docker compose up -d | Out-Null
} finally {
    Pop-Location
}

# 4) Quick smoke from host
Start-Sleep -Seconds 3

function Hit($url){
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 8
        Ok "$url => $($r.StatusCode)"
    }
    catch {
        Warn "$url => $($_.Exception.Message)"
    }
}

Info "HTTP smoke on localhost:8000"
Hit "http://localhost:8000/health"
Hit "http://localhost:8000/config"
Hit "http://localhost:8000/clients"
Hit "http://localhost:8000/invoices"
Hit "http://localhost:8000/products"
