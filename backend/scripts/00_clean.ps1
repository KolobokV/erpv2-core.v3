Param([switch]$PruneImages)
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir\..

Write-Host "== Cleaning ERPv2_backend_connect =="
docker compose down -v --remove-orphans

if ($PruneImages) {
    Write-Host " - Removing image(s)"
    $service = "erpv2_backend_connect"
    $imgs = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String $service
    foreach ($img in $imgs) {
        docker rmi -f ($img.ToString().Trim()) | Out-Null
    }
}
Write-Host "== Done =="
