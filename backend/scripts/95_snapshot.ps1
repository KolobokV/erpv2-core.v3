$ErrorActionPreference = "Stop"
$endpoint = "http://localhost:8000/snapshot"
Write-Host "== Creating snapshot via $endpoint =="
try {
    $r = Invoke-WebRequest $endpoint -Method POST -UseBasicParsing -TimeoutSec 30
    $json = $r.Content | ConvertFrom-Json
    Write-Host "Snapshot OK -> $($json.file)"
} catch {
    Write-Warning $_.Exception.Message
    exit 1
}
