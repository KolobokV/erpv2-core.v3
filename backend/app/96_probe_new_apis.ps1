param()

$ErrorActionPreference = "Stop"

Write-Host "== Probe new ERPv2 APIs (client profiles + internal processes) =="

$baseUrl = "http://localhost:8000"

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path
    )

    $url = "$baseUrl$Path"
    Write-Host ""
    Write-Host "---- $Method $Path ----"

    try {
        if ($Method -eq "GET") {
            $resp = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
        }
        else {
            throw "Unsupported method: $Method"
        }

        Write-Host "Status: $($resp.StatusCode)"
        $body = $resp.Content
        if ($body.Length -gt 400) {
            $bodyShort = $body.Substring(0, 400) + "`n... (truncated) ..."
        }
        else {
            $bodyShort = $body
        }
        Write-Host "Body:"
        Write-Host $bodyShort
    }
    catch {
        Write-Host "ERROR calling $url"
        Write-Host $_.Exception.Message
    }
}

# Existing known endpoint just as control
Test-Endpoint -Method "GET" -Path "/health"

# New client profiles API
Test-Endpoint -Method "GET" -Path "/api/client-profiles/"

# New internal processes APIs
Test-Endpoint -Method "GET" -Path "/api/internal/process-definitions"
Test-Endpoint -Method "GET" -Path "/api/internal/process-instances"

Write-Host ""
Write-Host "== Done =="
