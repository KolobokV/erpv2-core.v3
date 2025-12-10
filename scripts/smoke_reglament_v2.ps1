param(
    [string]$BaseUrl = "http://localhost:8000"
)

function Test-Endpoint {
    param(
        [string]$Url,
        [int]$ExpectedStatus = 200
    )

    Write-Host "[CHECK] $Url" -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -Headers @{ "accept" = "application/json" } -TimeoutSec 30
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host " => OK ($($response.StatusCode))"
            return $true
        } else {
            Write-Host " => FAIL ($($response.StatusCode))"
            return $false
        }
    }
    catch {
        Write-Host " => ERROR ($($_.Exception.Message))"
        return $false
    }
}

Write-Host "== ERP REGLEMENT SMOKE v2 =="

$allOk = $true

$allOk = (Test-Endpoint -Url "$BaseUrl/api/health") -and $allOk
$allOk = (Test-Endpoint -Url "$BaseUrl/api/tasks") -and $allOk
$allOk = (Test-Endpoint -Url "$BaseUrl/api/internal/process-instances-v2") -and $allOk

# Trigger single monthly reglament run for current reference period
$year = 2025
$month = 12
$regUrl = "$BaseUrl/api/internal/process-chains/reglement/run?year=$year&month=$month"

Write-Host "[CHECK] POST $regUrl" -NoNewline
try {
    $response = Invoke-WebRequest -Uri $regUrl -Method Post -Headers @{ "accept" = "application/json" } -Body "" -TimeoutSec 300
    if ($response.StatusCode -eq 200) {
        Write-Host " => OK (200)"
    } else {
        Write-Host " => FAIL ($($response.StatusCode))"
        $allOk = $false
    }
}
catch {
    Write-Host " => ERROR ($($_.Exception.Message))"
    $allOk = $false
}

if ($allOk) {
    Write-Host "[RESULT] REGLEMENT SMOKE PASSED"
    exit 0
} else {
    Write-Host "[RESULT] REGLEMENT SMOKE FAILED"
    exit 1
}
