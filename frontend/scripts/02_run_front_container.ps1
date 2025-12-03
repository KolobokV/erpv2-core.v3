Param(
    [string]$ImageName     = "erpv2_front:latest",
    [string]$ContainerName = "erpv2_front_standalone",
    [int]$HostPort         = 5175
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "== Run ERPv2 frontend Docker container =="

Write-Host "[INFO] Image name:      $ImageName"
Write-Host "[INFO] Container name:  $ContainerName"
Write-Host "[INFO] Host port:       $HostPort"

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

# Stop and remove existing container if it exists
$existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }
if ($existing) {
    Write-Host "[INFO] Stopping existing container: $ContainerName"
    docker stop $ContainerName | Out-Null
    Write-Host "[INFO] Removing existing container: $ContainerName"
    docker rm $ContainerName | Out-Null
}

# Run new container
$portMapping = "$HostPort`:80"

Write-Host "[STEP] Starting new container..."
docker run -d `
    --name $ContainerName `
    -p $portMapping `
    $ImageName | Out-Null

Write-Host "[OK] Container started." -ForegroundColor Green
Write-Host "[INFO] Open http://localhost:$HostPort in your browser."
