param(
    [string]$BackendDir   = "C:\Users\User\Desktop\ERP\ERPv2_backend_connect",
    [string]$DoliKeyPath  = "C:\Users\User\Desktop\ERP\ERP_Doli17_PresetAdmin_DockerHubOnly\init\api_key.txt"
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

# 1) Check paths
if (-not (Test-Path $BackendDir)) {
    throw "BackendDir not found: $BackendDir"
}

$envPath = Join-Path $BackendDir ".env"
if (-not (Test-Path $envPath)) {
    throw ".env not found: $envPath"
}

if (-not (Test-Path $DoliKeyPath)) {
    throw "Dolibarr api_key file not found: $DoliKeyPath"
}

# 2) Read key from file
Info "Reading Dolibarr API key from file"
$key = (Get-Content -Raw -Path $DoliKeyPath).Trim()
if (-not $key) {
    throw "Dolibarr API key file is empty"
}

# 3) Patch .env: remove old DOLI_API_KEY lines and append fresh one
Info "Updating .env with DOLI_API_KEY"

$lines = @()
if (Test-Path $envPath) {
    $lines = Get-Content $envPath
}

$lines = $lines | Where-Object { $_ -notmatch '^\s*DOLI_API_KEY\s*=' }

$lines += "DOLI_API_KEY=$key"

# UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($envPath, $lines, $utf8NoBom)

Ok ".env updated with DOLI_API_KEY"

# 4) Restart container via docker compose (WITHOUT 01_up.ps1)
Info "Restarting backend container via docker compose up -d"

Push-Location $BackendDir
try {
    docker compose up -d | Out-Null
} finally {
    Pop-Location
}

Ok "Backend restarted. Now container should see DOLI_API_KEY"
