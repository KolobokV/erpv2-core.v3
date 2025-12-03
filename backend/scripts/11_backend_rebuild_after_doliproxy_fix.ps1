param(
    [string]$Root = "C:\Users\User\Desktop\ERP\ERPv2_backend_connect"
)

Write-Host "=== ERPv2 backend: rebuild after doliproxy SafeMode ==="
Write-Host "Backend root: $Root"
Write-Host ""

if (-Not (Test-Path $Root)) {
    Write-Host "[ERROR] Backend root path does not exist."
    exit 1
}

cd $Root

Write-Host "[INFO] Docker compose down..."
docker compose down

Write-Host "[INFO] Docker compose build (no cache)..."
docker compose build --no-cache

Write-Host "[INFO] Docker compose up -d..."
docker compose up -d

Write-Host ""
Write-Host "[INFO] Waiting 10 seconds for backend to start..."
Start-Sleep -Seconds 10

Write-Host "[INFO] Probing backend endpoints on http://localhost:8000 ..."
$urls = @(
    "http://localhost:8000/health",
    "http://localhost:8000/health/dolibarr",
    "http://localhost:8000/clients?limit=5",
    "http://localhost:8000/invoices?limit=5",
    "http://localhost:8000/products?limit=5"
)

foreach ($u in $urls) {
    Write-Host ""
    Write-Host "=== GET $u ==="
    try {
        $resp = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10
        Write-Host "StatusCode: $($resp.StatusCode)"
        if ($resp.Content) {
            Write-Host "Body:"
            Write-Host $resp.Content
        }
    } catch {
        Write-Host "[ERROR] Request failed: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "=== Done (backend rebuild + probe) ==="
