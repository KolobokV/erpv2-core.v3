param([string]$BaseDir = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2")
$ErrorActionPreference = "Stop"
function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }

Push-Location $BaseDir
try {
  Info "docker compose build"
  docker compose build
  Info "docker compose up -d"
  docker compose up -d
  Start-Sleep -Seconds 3
  Ok "Stack is up. Try: http://localhost:5173"
} finally { Pop-Location }
