param()

Write-Host "== ERP LOCAL SMOKE v1 =="

$ErrorCount = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "[OK] $Name => $($response.StatusCode)"
        }
        else {
            Write-Host "[ERROR] $Name => $($response.StatusCode) (expected $ExpectedStatus)"
            $global:ErrorCount++
        }
    }
    catch {
        Write-Host "[ERROR] $Name => request failed: $($_.Exception.Message)"
        $global:ErrorCount++
    }
}

# FRONTEND
Test-Endpoint -Name "FRONT 5173" -Url "http://localhost:5173/"

# BACKEND BASE
Test-Endpoint -Name "API HEALTH" -Url "http://localhost:8000/api/health"
Test-Endpoint -Name "API CONFIG" -Url "http://localhost:8000/api/config"

# TASKS
Test-Endpoint -Name "API TASKS" -Url "http://localhost:8000/api/tasks"

# INTERNAL PROCESSES
Test-Endpoint -Name "API INTERNAL CLIENT PROFILES" -Url "http://localhost:8000/api/internal/client-profiles"
Test-Endpoint -Name "API INTERNAL DEFINITIONS" -Url "http://localhost:8000/api/internal/process-definitions"
Test-Endpoint -Name "API INTERNAL INSTANCES" -Url "http://localhost:8000/api/internal/process-instances"

# CONTROL EVENTS
Test-Endpoint -Name "API CONTROL EVENTS ip_usn_dr" -Url "http://localhost:8000/api/control-events/ip_usn_dr?year=2025&month=12"

if ($ErrorCount -eq 0) {
    Write-Host "[OK] Local smoke tests passed."
    exit 0
}
else {
    Write-Host "[WARN] Local smoke tests finished with errors: $ErrorCount endpoint(s) failed."
    exit 1
}
