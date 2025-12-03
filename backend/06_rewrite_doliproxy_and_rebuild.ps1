# 06_rewrite_doliproxy_and_rebuild.ps1
# Rewrite app/doliproxy.py with a clean implementation and rebuild backend.

$ErrorActionPreference = "Stop"

function Info($m) { Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "[FAIL] $m" -ForegroundColor Red }

# Project root = folder where this script is located
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Info "Project root: $ProjectRoot"

# Path to doliproxy.py
$pyPath = Join-Path $ProjectRoot "app\doliproxy.py"
if (!(Test-Path $pyPath)) {
    Fail "File not found: $pyPath"
    exit 1
}

# New Python source for doliproxy.py
$py = @'
import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

DOLI_API_URL = os.getenv("DOLI_API_URL", "http://host.docker.internal:8282/api/index.php").rstrip("/")
DOLI_API_KEY = os.getenv("DOLI_API_KEY")


async def _call_dolibarr(
    endpoint: str,
    params: Optional[Dict[str, Any]] = None,
) -> Any:
    """
    Generic helper to call Dolibarr REST API.

    - Uses DOLI_API_URL as base, strips trailing slash.
    - Uses DOLI_API_KEY as header DOLAPIKEY.
    - Raises HTTPException with useful detail on errors.
    """
    if not DOLI_API_KEY:
        raise HTTPException(status_code=500, detail="DOLI_API_KEY not set")

    base = DOLI_API_URL.rstrip("/")
    url = f"{base}/{endpoint.lstrip('/')}"
    headers = {"DOLAPIKEY": DOLI_API_KEY}

    timeout = httpx.Timeout(10.0, connect=5.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url, headers=headers, params=params)
        except httpx.RequestError as exc:
            # Connection issues, DNS problem, etc.
            raise HTTPException(
                status_code=500,
                detail=f"Dolibarr connect error: {exc}",
            )

    if response.status_code >= 400:
        # Try to show some body text from Dolibarr for debugging
        body_text = response.text
        if len(body_text) > 1000:
            body_text = body_text[:1000]
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Dolibarr error {response.status_code}: {body_text}",
        )

    # Dolibarr usually returns JSON
    try:
        return response.json()
    except ValueError:
        # Not a JSON response, return raw text
        return response.text


@router.get("/health/dolibarr")
async def health_dolibarr() -> Dict[str, Any]:
    """
    Simple health check against Dolibarr.

    We call a lightweight endpoint to verify:
    - URL is reachable
    - API key is valid
    """
    data = await _call_dolibarr("setup/constants", params={"limit": 1})
    result: Dict[str, Any] = {"status": "ok"}

    if isinstance(data, list) and data:
        result["sample"] = data[0]
    else:
        result["sample"] = data

    return result


@router.get("/clients")
async def list_clients(
    limit: int = 50,
    page: int = 0,
) -> Any:
    """
    Proxy to Dolibarr thirdparties (clients/suppliers).
    """
    params = {
        "limit": limit,
        "page": page,
        "sortfield": "t.rowid",
        "sortorder": "ASC",
    }
    return await _call_dolibarr("thirdparties", params=params)


@router.get("/invoices")
async def list_invoices(
    limit: int = 50,
    page: int = 0,
) -> Any:
    """
    Proxy to Dolibarr customer invoices.
    """
    params = {
        "limit": limit,
        "page": page,
        "sortfield": "f.rowid",
        "sortorder": "DESC",
    }
    return await _call_dolibarr("invoices", params=params)


@router.get("/products")
async def list_products(
    limit: int = 50,
    page: int = 0,
) -> Any:
    """
    Proxy to Dolibarr products.
    """
    params = {
        "limit": limit,
        "page": page,
        "sortfield": "p.rowid",
        "sortorder": "ASC",
    }
    return await _call_dolibarr("products", params=params)
'@

# Write file as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($pyPath, $py, $utf8NoBom)
Ok "doliproxy.py rewritten: $pyPath"

# 2) Rebuild and restart backend container
Info "docker compose build"
Push-Location $ProjectRoot
try {
    docker compose build | Out-Null
    Ok "docker compose build OK"

    Info "docker compose up -d"
    docker compose up -d | Out-Null
    Ok "docker compose up -d OK"
}
finally {
    Pop-Location
}

# 3) Quick smoke for health and clients
Info "HTTP smoke via PowerShell"
function Hit($url) {
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10
        return "[OK] $url => " + [int]$r.StatusCode
    } catch {
        return "[ERR] $url => " + $_.Exception.Message
    }
}

Write-Host (Hit "http://localhost:8000/health")
Write-Host (Hit "http://localhost:8000/health/dolibarr")
Write-Host (Hit "http://localhost:8000/clients")
Write-Host (Hit "http://localhost:8000/invoices")
Write-Host (Hit "http://localhost:8000/products")
Ok "Done"
