param([string]$BaseDir = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2")
$ErrorActionPreference = "Stop"
function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }

Push-Location $BaseDir
try {
  Info "docker compose down --remove-orphans"
  docker compose down --remove-orphans
  Ok "Stopped."
} finally { Pop-Location }
