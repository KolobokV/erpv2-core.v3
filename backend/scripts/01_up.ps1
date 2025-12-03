param(
    [string]$ComposeFile = "docker-compose.yml"
)

$ErrorActionPreference = "Stop"

Write-Host "== Start ERPv2_backend_connect stack =="

# Resolve script directory and go there
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile (current dir: $projectRoot)"
}

Write-Host "[INFO] Using compose file: $ComposeFile"
Write-Host "[STEP] docker compose build"
docker compose -f $ComposeFile build
if ($LASTEXITCODE -ne 0) {
    throw "docker compose build failed with exit code $LASTEXITCODE"
}

Write-Host "[STEP] docker compose up -d"
docker compose -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) {
    throw "docker compose up -d failed with exit code $LASTEXITCODE"
}

Write-Host "[STEP] docker compose ps"
docker compose -f $ComposeFile ps

Write-Host "== ERPv2_backend_connect stack is up on http://localhost:8000 =="
