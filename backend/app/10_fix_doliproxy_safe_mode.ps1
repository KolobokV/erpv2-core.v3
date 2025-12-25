param(
    [string]$Root = "C:\Users\User\Desktop\ERP\ERPv2_backend_connect"
)

Write-Host "=== ERPv2 backend: doliproxy SafeMode fix ==="
Write-Host "Backend root: $Root"
Write-Host ""

if (-Not (Test-Path $Root)) {
    Write-Host "[ERROR] Backend root path does not exist."
    exit 1
}

$appDir = Join-Path $Root "app"
$doliFile = Join-Path $appDir "doliproxy.py"

if (-Not (Test-Path $doliFile)) {
    Write-Host "[ERROR] doliproxy.py not found at: $doliFile"
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $Root ("_savepoints_backend_fix_" + $timestamp)

Write-Host "[INFO] Creating backup directory: $backupDir"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Host "[INFO] Backing up doliproxy.py -> $backupDir"
Copy-Item -Path $doliFile -Destination (Join-Path $backupDir "doliproxy.py.bak") -Force

Write-Host "[INFO] Writing new doliproxy.py (SafeMode)..."

$code = @'
import os
from typing import Any, Dict, Optional, Tuple

import httpx
from fastapi import APIRouter

router = APIRouter(tags=["Dolibarr"])


def _get_dolibarr_base_and_key() -> Tuple[str, Optional[str]]:
    """
    Read Dolibarr base URL and API key from env.
    DOLI_API_URL example: http://host.docker.internal:8282/api/index.php
    This function NEVER raises HTTP exceptions. It only returns (base, key or None).
    """
    base = os.getenv("DOLI_API_URL") or "http://host.docker.internal:8282/api/index.php"
    key = os.getenv("DOLI_API_KEY")
    return base.rstrip("/"), key


async def _call_dolibarr(path: str, params: Optional[Dict[str, Any]] = None) -> Tuple[bool, Any]:
    """
    Generic helper to call Dolibarr REST API and return (ok, data_or_error).
    It NEVER raises HTTPException. All errors are converted to (False, message).
    On success: (True, json or text).
    """
    base, key = _get_dolibarr_base_and_key()

    if not key:
        return False, "DOLI_API_KEY is not set"

    url = f"{base}/{path.lstrip('/')}"
    q: Dict[str, Any] = dict(params or {})
    q["DOLAPIKEY"] = key

    timeout = httpx.Timeout(10.0, connect=5.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, params=q)
    except httpx.RequestError as exc:
        return False, f"Dolibarr unreachable: {exc}"

    if resp.status_code != 200:
        return False, f"Dolibarr error {resp.status_code}: {resp.text}"

    try:
        return True, resp.json()
    except ValueError:
        # Fallback: return raw text if JSON parsing fails
        return True, resp.text


@router.get("/health/dolibarr")
async def health_dolibarr() -> Dict[str, Any]:
    """
    Simple health-check against Dolibarr.
    It NEVER returns HTTP 5xx. If Dolibarr is not configured or broken,
    status will be "error" instead of raising.
    """
    ok, _ = await _call_dolibarr("thirdparties", params={"limit": 1})
    if ok:
        return {"status": "ok"}
    return {"status": "error"}


@router.get("/clients")
async def list_clients(limit: int = 100, page: int = 0) -> Any:
    """
    Map /clients -> Dolibarr /thirdparties.
    On any error returns an empty list [] with HTTP 200.
    """
    params = {
        "limit": limit,
        "page": page,
        "sortfield": "t.rowid",
        "sortorder": "ASC",
    }
    ok, data = await _call_dolibarr("thirdparties", params=params)

    if not ok:
        # Safe fallback: backend stays alive, client sees an empty list.
        return []

    # Normalize to list
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        items = data.get("items")
        if isinstance(items, list):
            return items
    return []


@router.get("/invoices")
async def list_invoices(limit: int = 100) -> Any:
    """
    Map /invoices -> Dolibarr /invoices.
    On any error returns an empty list [] with HTTP 200.
    """
    params = {
        "limit": limit,
    }
    ok, data = await _call_dolibarr("invoices", params=params)

    if not ok:
        return []

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        items = data.get("items")
        if isinstance(items, list):
            return items
    return []


@router.get("/products")
async def list_products(limit: int = 100) -> Any:
    """
    Map /products -> Dolibarr /products.
    On any error returns an empty list [] with HTTP 200.
    """
    params = {
        "limit": limit,
    }
    ok, data = await _call_dolibarr("products", params=params)

    if not ok:
        return []

    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        items = data.get("items")
        if isinstance(items, list):
            return items
    return []
'@

Set-Content -Path $doliFile -Value $code -Encoding UTF8

Write-Host "[OK] New doliproxy.py written."
Write-Host ""
Write-Host "Next steps:"
Write-Host " 1) Restart backend container to pick up changes."
Write-Host "    Example:"
Write-Host "       cd `"$Root`""
Write-Host "       powershell -ExecutionPolicy Bypass -File .\scripts\01_up.ps1"
Write-Host ""
Write-Host " 2) Run smoke tests from ERP root:"
Write-Host "       cd C:\Users\User\Desktop\ERP"
Write-Host "       powershell -ExecutionPolicy Bypass -File .\ERP_CORE_launcher.ps1 -Action smoke"
Write-Host ""
Write-Host "=== Done (doliproxy SafeMode) ==="
