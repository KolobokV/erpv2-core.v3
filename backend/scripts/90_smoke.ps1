
$ErrorActionPreference = "Stop"
$base = "http://localhost:8000"
$checks = @(
  "/health",
  "/config",
  "/clients?limit=1&sortfield=t.rowid&sortorder=ASC",
  "/invoices?limit=1",
  "/products?limit=1"
)
Write-Host "== Smoke test =="
foreach ($c in $checks) {
    $url = "$base$c"
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
        Write-Host (" {0,-45} {1}" -f $c, $r.StatusCode)
    } catch {
        Write-Warning (" {0,-45} FAIL: {1}" -f $c, $_.Exception.Message)
        exit 1
    }
}
Write-Host "== OK ==" -ForegroundColor Green
