param(
    [string]$Root = "C:\Users\User\Desktop\ERP\ERPv2_backend_connect",
    [string]$Old  = "http://host.docker.internal:8000",
    [string]$New  = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

if (-not (Test-Path $Root)) {
    throw "Project root not found: $Root"
}

$appDir = Join-Path $Root "app"
if (-not (Test-Path $appDir)) {
    throw "App folder not found: $appDir"
}

Info "Searching for '$Old' in *.py under $appDir"

$files = Get-ChildItem -Path $appDir -Recurse -Filter *.py
if (-not $files) {
    throw "No .py files found in $appDir"
}

$encoding = New-Object System.Text.UTF8Encoding($false)
$changed = 0

foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName)
    if ($text -like ("*" + $Old + "*")) {
        $backup = "$($f.FullName).bak_$(Get-Date -Format yyyyMMdd_HHmmss)"
        Copy-Item $f.FullName $backup -Force

        $newText = $text.Replace($Old, $New)
        [System.IO.File]::WriteAllText($f.FullName, $newText, $encoding)

        Ok ("Patched file: {0} (backup: {1})" -f $f.Name, $backup)
        $changed++
    }
}

if ($changed -eq 0) {
    Warn "No occurrences of '$Old' found in *.py files. Nothing to patch."
} else {
    Ok ("Total patched files: {0}" -f $changed)
}

# Rebuild and restart backend
Push-Location $Root
try {
    Info "docker compose build"
    docker compose build | Out-Null

    Info "docker compose up -d"
    docker compose up -d | Out-Null
    Ok "Backend rebuilt and started"
}
finally {
    Pop-Location
}

# Quick HTTP smoke
function Hit($u){
    try {
        $r = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 8
        Ok ("{0} => {1}" -f $u, $r.StatusCode)
    } catch {
        Warn ("{0} => {1}" -f $u, $_.Exception.Message)
    }
}

Info "HTTP smoke after patch"
Hit "http://localhost:8000/health"
Hit "http://localhost:8000/config"
Hit "http://localhost:8000/clients"
