Param(
    [string]$ImageName = "erpv2_front:latest"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "== Build ERPv2 frontend Docker image =="

# Resolve script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Write-Host "[INFO] Project root: $projectRoot"
Write-Host "[INFO] Image name:   $ImageName"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker CLI not found in PATH." -ForegroundColor Red
    exit 1
}

try {
    docker version > $null 2>&1
} catch {
    Write-Host "[ERROR] Docker is not running or not accessible." -ForegroundColor Red
    exit 1
}

$dockerfilePath = Join-Path $projectRoot "Dockerfile"
if (-not (Test-Path $dockerfilePath)) {
    Write-Host "[ERROR] Dockerfile not found at $dockerfilePath" -ForegroundColor Red
    exit 1
}

Push-Location $projectRoot
try {
    Write-Host "[STEP] Building image..."
    docker build -t $ImageName .
    Write-Host "[OK] Image built: $ImageName" -ForegroundColor Green
}
finally {
    Pop-Location
}
