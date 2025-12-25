Param(
    [string]$DolibarrScripts = "..\ERP_Doli17_PresetAdmin_DockerHubOnly\scripts\01_up.ps1",
    [string]$BackendScripts  = ".\scripts\01_up.ps1",
    [switch]$Rebuild
)
$ErrorActionPreference = "Stop"
Write-Host "== ERPv2 RUN ORCHESTRATION =="
if (Test-Path $DolibarrScripts) {
    Write-Host " - Starting Dolibarr via $DolibarrScripts"
    & powershell -ExecutionPolicy Bypass -File $DolibarrScripts
} else {
    Write-Warning " - Dolibarr script not found: $DolibarrScripts (continuing)"
}
if (Test-Path $BackendScripts) {
    Write-Host " - Starting Backend via $BackendScripts"
    if ($Rebuild) {
        & powershell -ExecutionPolicy Bypass -File $BackendScripts -Rebuild
    } else {
        & powershell -ExecutionPolicy Bypass -File $BackendScripts
    }
} else {
    throw "Backend script not found: $BackendScripts"
}
Write-Host " - Running smoke tests"
& powershell -ExecutionPolicy Bypass -File ".\scripts\90_smoke.ps1"
