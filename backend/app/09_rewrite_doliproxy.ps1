# 09_rewrite_doliproxy.ps1
# Rewrite app/doliproxy.py to a simple, robust version

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

$appDir = Join-Path $root "app"
$doliFile = Join-Path $appDir "doliproxy.py"

if (!(Test-Path $appDir)) {
    throw "app directory not found: $appDir"
}
if (!(Test-Path $doliFile)) {
    throw "doliproxy.py not found: $doliFile"
}

Info "Rewriting doliproxy.py"
$backup = "$doliFile.bak_$(Get-Date -Format yyyyMMdd_HHmmss)"
Copy-Item $doliFile $backup -Force
Ok "Backup created: $backup"

$py = @'
import os
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["Dolibarr"])


def _get_dolibarr_base_and_key() -> (str, str):
    """
    Read Dolibarr base URL and API key from env.
    DOLI_API_URL example: http://host.docker.internal:8282/api/index.php
    """
    base = os.getenv("DOLI_API_URL") or "http://host.docker.internal:8282/api/index.php"
    key = os.getenv("DOLI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="DOLI_API_KEY is not set")
    return base.rstrip("/"), key


async def _call_dolibarr(path: str, params: Optional[Dict[str, Any]] = None) -> Any:
    """
    Generic helper to call Dolibarr REST API and return JSON.
    Raises HTTPException 503 on transport or non-200 response.
    """
    base, key = _get_dolibarr_base_and_key()
    url = f"{base}/{path.lstrip('/')}"
    q = dict(params or {})
    q["DOLAPIKEY"] = key

    timeout = httpx.Timeout(10.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(url, params=q)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Dolibarr unreachable: {exc}"
            ) from exc

    if resp.status_code != 200:
        # Surface Dolibarr error as 503 for the front
        text = resp.text
        raise HTTPException(
            status_code=503,
            detail=f"Dolibarr error {resp.status_code}: {text}"
        )

    # Assume Dolibarr always returns JSON here
    try:
        return resp.json()
    except ValueError:
        # Not JSON -> still return raw text
        return resp.text


@router.get("/health/dolibarr")
async def health_dolibarr() -> Dict[str, Any]:
    """
    Simple health-check for Dolibarr.
    We call thirdparties with limit=1 just to see that API works.
    """
    await _call_dolibarr(
        "thirdparties",
        params={"limit": 1, "page": 0},
    )
    return {"status": "ok"}


@router.get("/clients")
async def list_clients(limit: int = 100, page: int = 0) -> Any:
    """
    Map /clients -> Dolibarr /thirdparties
    """
    params = {
        "limit": limit,
        "page": page,
        "sortfield": "t.rowid",
        "sortorder": "ASC",
    }
    return await _call_dolibarr("thirdparties", params=params)


@router.get("/invoices")
async def list_invoices(limit: int = 100, page: int = 0) -> Any:
    """
    Map /invoices -> Dolibarr /invoices
    """
    params = {
        "limit": limit,
        "page": page,
        "sortfield": "f.rowid",
        "sortorder": "DESC",
    }
    return await _call_dolibarr("invoices", params=params)


@router.get("/products")
async def list_products(limit: int = 100, page: int = 0) -> Any:
    """
    Map /products -> Dolibarr /products
    """
    params = {
        "limit": limit,
        "page": page,
        "sortfield": "p.rowid",
        "sortorder": "ASC",
    }
    return await _call_dolibarr("products", params=params)
'@

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($doliFile, $py, $enc)
Ok "doliproxy.py rewritten (UTF-8 without BOM)"

Push-Location $root
try {
    Info "docker compose build"
    docker compose build | Out-Null
    Ok "docker compose build OK"

    Info "docker compose up -d"
    docker compose up -d | Out-Null
    Ok "docker compose up -d OK"
}
finally {
    Pop-Location
}

Start-Sleep -Seconds 3

function Hit($url){
    try {
        $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 8
        Ok "$url => $($r.StatusCode)"
    }
    catch {
        Warn "$url => $($_.Exception.Message)"
    }
}

Info "HTTP smoke on localhost:8000 after doliproxy rewrite"
Hit "http://localhost:8000/health"
Hit "http://localhost:8000/health/dolibarr"
Hit "http://localhost:8000/clients"
Hit "http://localhost:8000/invoices"
Hit "http://localhost:8000/products"
