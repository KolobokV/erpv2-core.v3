param(
    [string]$Root = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage3_connect"
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }

if (!(Test-Path $Root)) { throw "Нет папки: $Root" }

Push-Location $Root
try{
    Info "docker compose build"
    docker compose build | Out-Null

    Info "docker compose up -d"
    docker compose up -d | Out-Null
}
finally{
    Pop-Location
}

Start-Sleep 5

function Hit($u){
    try {
        (Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 6).StatusCode
    } catch {
        $_.Exception.Message
    }
}

Ok ("ROOT        => {0}" -f (Hit "http://localhost:5173/"))
Ok ("API health  => {0}" -f (Hit "http://localhost:5173/api/health"))
Ok ("API config  => {0}" -f (Hit "http://localhost:5173/api/config"))
Ok ("EXT health  => {0}" -f (Hit "http://localhost:8088/health"))
Ok ("EXT clients => {0}" -f (Hit "http://localhost:5173/api-ext/clients"))
