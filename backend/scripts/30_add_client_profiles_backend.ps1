param()

$ErrorActionPreference = "Stop"

Write-Host "== ERPv2 Client Profile backend init =="

# Resolve paths
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendRoot = Split-Path -Parent $scriptDir
$appDir      = Join-Path $backendRoot "app"
$dataDir     = Join-Path $backendRoot "data"

if (!(Test-Path $appDir)) {
    throw "App directory not found: $appDir"
}

if (!(Test-Path $dataDir)) {
    Write-Host "[INFO] Creating data directory: $dataDir"
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}

function Backup-IfExists {
    param(
        [string]$Path
    )
    if (Test-Path $Path) {
        $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "$Path.bak_$stamp"
        Copy-Item $Path $backupPath
        Write-Host "[INFO] Backup created: $backupPath"
    }
}

$storePath = Join-Path $appDir "client_profiles_store.py"
$routesPath = Join-Path $appDir "routes_client_profiles.py"
$mainPath  = Join-Path $appDir "main.py"

if (!(Test-Path $mainPath)) {
    throw "main.py not found at $mainPath"
}

# --- Write client_profiles_store.py ---
Backup-IfExists -Path $storePath

$storeContent = @'
from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

_LOCK = threading.Lock()

_default_path = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "client_profiles.json"
)

FILE_PATH = Path(os.getenv("CLIENT_PROFILES_PATH", str(_default_path)))


def _load_raw() -> List[Dict[str, Any]]:
    if not FILE_PATH.exists():
        return []
    try:
        with FILE_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict)]
    except Exception:
        # In safe mode we never propagate errors up
        return []


def _save_raw(items: List[Dict[str, Any]]) -> None:
    FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = FILE_PATH.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    tmp_path.replace(FILE_PATH)


def list_profiles() -> List[Dict[str, Any]]:
    with _LOCK:
        return _load_raw()


def get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        items = _load_raw()
        for item in items:
            if str(item.get("id")) == str(profile_id):
                return item
    return None


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def upsert_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    with _LOCK:
        items = _load_raw()

        raw_id = data.get("id")
        if not raw_id:
            raw_id = f"cli_{int(datetime.utcnow().timestamp())}"
        profile_id = str(raw_id)

        found = None
        for item in items:
            if str(item.get("id")) == profile_id:
                found = item
                break

        now = _now_iso()

        if found is None:
            # create new
            new_item: Dict[str, Any] = {
                "id": profile_id,
                "created_at": now,
            }
            new_item.update(data)
            new_item["updated_at"] = now
            items.append(new_item)
            _save_raw(items)
            return new_item

        # update existing
        found.update(data)
        found["id"] = profile_id
        found["updated_at"] = now
        if "created_at" not in found:
            found["created_at"] = now
        _save_raw(items)
        return found


def delete_profile(profile_id: str) -> bool:
    with _LOCK:
        items = _load_raw()
        new_items = [x for x in items if str(x.get("id")) != str(profile_id)]
        deleted = len(new_items) != len(items)
        if deleted:
            _save_raw(new_items)
        return deleted
'@

Set-Content -Path $storePath -Value $storeContent -Encoding UTF8
Write-Host "[OK] Written: $storePath"

# --- Write routes_client_profiles.py ---
Backup-IfExists -Path $routesPath

$routesContent = @'
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from . import client_profiles_store as store


class PayrollBlock(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    period: Optional[str] = None  # for example: "month", "quarter"


class ClientProfileIn(BaseModel):
    id: Optional[str] = Field(
        default=None,
        description="Internal client id. If missing, backend will generate one.",
    )
    name: str = Field(..., description="Display name of the client")
    inn: Optional[str] = None
    kpp: Optional[str] = None
    tax_regime: Optional[str] = None
    taxation_system: Optional[str] = None
    employees_count: Optional[int] = None
    payroll_fund: Optional[float] = None
    payroll_scheme: Optional[str] = None
    sla: Optional[Dict[str, Any]] = None
    internal_notes: Optional[str] = None
    contacts: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, Any]]] = None
    payroll_blocks: Optional[List[PayrollBlock]] = None


class ClientProfile(ClientProfileIn):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ClientProfileResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    profile: Optional[ClientProfile] = None


class ClientProfileListResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    items: List[ClientProfile]


router = APIRouter(
    prefix="/api/client-profiles",
    tags=["client_profiles"],
)


@router.get("/", response_model=ClientProfileListResponse)
async def list_client_profiles() -> ClientProfileListResponse:
    try:
        raw_items = store.list_profiles()
        items = [ClientProfile(**item) for item in raw_items]
        return ClientProfileListResponse(ok=True, items=items, error=None)
    except Exception as exc:
        return ClientProfileListResponse(ok=False, items=[], error=str(exc))


@router.get("/{profile_id}", response_model=ClientProfileResponse)
async def get_client_profile(profile_id: str) -> ClientProfileResponse:
    try:
        raw = store.get_profile(profile_id)
        if raw is None:
            return ClientProfileResponse(
                ok=False,
                error="Client profile not found",
                profile=None,
            )
        return ClientProfileResponse(ok=True, error=None, profile=ClientProfile(**raw))
    except Exception as exc:
        return ClientProfileResponse(ok=False, error=str(exc), profile=None)


@router.post("/", response_model=ClientProfileResponse)
async def create_client_profile(payload: ClientProfileIn) -> ClientProfileResponse:
    try:
        data = payload.dict(exclude_unset=True)
        stored = store.upsert_profile(data)
        return ClientProfileResponse(ok=True, error=None, profile=ClientProfile(**stored))
    except Exception as exc:
        return ClientProfileResponse(ok=False, error=str(exc), profile=None)


@router.put("/{profile_id}", response_model=ClientProfileResponse)
async def update_client_profile(
    profile_id: str,
    payload: ClientProfileIn,
) -> ClientProfileResponse:
    try:
        existing = store.get_profile(profile_id)
        if existing is None:
            return ClientProfileResponse(
                ok=False,
                error="Client profile not found",
                profile=None,
            )
        data = existing.copy()
        data.update(payload.dict(exclude_unset=True))
        data["id"] = profile_id
        stored = store.upsert_profile(data)
        return ClientProfileResponse(ok=True, error=None, profile=ClientProfile(**stored))
    except Exception as exc:
        return ClientProfileResponse(ok=False, error=str(exc), profile=None)


@router.delete("/{profile_id}", response_model=ClientProfileResponse)
async def delete_client_profile(profile_id: str) -> ClientProfileResponse:
    try:
        deleted = store.delete_profile(profile_id)
        if not deleted:
            return ClientProfileResponse(
                ok=False,
                error="Client profile not found",
                profile=None,
            )
        return ClientProfileResponse(ok=True, error=None, profile=None)
    except Exception as exc:
        return ClientProfileResponse(ok=False, error=str(exc), profile=None)
'@

Set-Content -Path $routesPath -Value $routesContent -Encoding UTF8
Write-Host "[OK] Written: $routesPath"

# --- Patch main.py: wire router ---
Backup-IfExists -Path $mainPath

$appendContent = @'
# Client profiles router auto-wiring (safe mode)
try:
    from .routes_client_profiles import router as client_profiles_router  # type: ignore
    app.include_router(client_profiles_router)
except Exception as e:  # pragma: no cover
    import logging
    logging.getLogger("erpv2").warning(
        "Failed to register client_profiles router: %s",
        e,
    )
'@

Add-Content -Path $mainPath -Value $appendContent -Encoding UTF8
Write-Host "[OK] Patched main.py: client_profiles router wired"

Write-Host "== Done. You can now rebuild backend and call /api/client-profiles =="
