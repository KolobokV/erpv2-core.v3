# 04_debug_dolibarr.ps1
# Diagnostics for Dolibarr <-> backend connection.

param(
    [string]$ProjectRoot    = $(Split-Path -Parent $MyInvocation.MyCommand.Path),
    [string]$DolibarrBaseUrl = "http://localhost:8282"
)

$ErrorActionPreference = "Stop"

function Info($m) { Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red }

Info "Project root: $ProjectRoot"

# 1) Environment inside container
Info "Env vars inside container (DOLI_API_URL / DOLI_API_KEY)"
try {
    docker exec erpv2_backend_connect printenv DOLI_API_URL
    docker exec erpv2_backend_connect printenv DOLI_API_KEY
} catch {
    Warn "docker exec failed: $($_.Exception.Message)"
}

# 2) Dolibarr API from host (using same API key)
$apiKeyPath = "C:\Users\User\Desktop\ERP\ERP_Doli17_PresetAdmin_DockerHubOnly\init\api_key.txt"

if (Test-Path $apiKeyPath) {
    Info "Reading API key from file: $apiKeyPath"
    $key = (Get-Content $apiKeyPath -Raw).Trim()

    $urlThird = "$DolibarrBaseUrl/api/index.php/thirdparties?DOLAPIKEY=$key&limit=1"
    Info "Testing Dolibarr thirdparties from HOST:"
    Write-Host "URL: $urlThird"

    try {
        $r = Invoke-WebRequest $urlThird -UseBasicParsing -TimeoutSec 10
        Ok ("Dolibarr /thirdparties => {0}, len={1}" -f $r.StatusCode, $r.Content.Length)
    } catch {
        Warn ("Dolibarr /thirdparties failed: {0}" -f $_.Exception.Message)
        if ($_.Exception.Response -ne $null) {
            $code = [int]$_.Exception.Response.StatusCode
            Warn ("HTTP code: {0}" -f $code)

            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            $reader.Dispose()
            Write-Host "=== Dolibarr BODY ==="
            Write-Host $body
        }
    }
} else {
    Warn "API key file not found: $apiKeyPath"
}

# 3) Backend /health/dolibarr
Info "Testing backend /health/dolibarr"
try {
    $r = Invoke-WebRequest "http://localhost:8000/health/dolibarr" -UseBasicParsing -TimeoutSec 10
    Ok ("/health/dolibarr => {0}, body={1}" -f $r.StatusCode, $r.Content)
} catch {
    Warn ("/health/dolibarr failed: {0}" -f $_.Exception.Message)
    if ($_.Exception.Response -ne $null) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Dispose()
        Write-Host "=== /health/dolibarr BODY ==="
        Write-Host $body
    }
}

# 4) Backend /clients (body on 500)
Info "Testing backend /clients"
try {
    $r = Invoke-WebRequest "http://localhost:8000/clients" -UseBasicParsing -TimeoutSec 10
    Ok ("/clients => {0}, len={1}" -f $r.StatusCode, $r.Content.Length)
    Write-Host "=== /clients BODY (first 500 chars) ==="
    if ($r.Content.Length -gt 500) {
        Write-Host $r.Content.Substring(0, 500)
    } else {
        Write-Host $r.Content
    }
} catch {
    Warn ("/clients failed: {0}" -f $_.Exception.Message)
    if ($_.Exception.Response -ne $null) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Dispose()
        Write-Host "=== /clients BODY ==="
        Write-Host $body
    }
}
