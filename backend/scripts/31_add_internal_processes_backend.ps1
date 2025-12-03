param()

$ErrorActionPreference = "Stop"

Write-Host "== ERPv2 Internal Processes backend init =="

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

$storePath  = Join-Path $appDir "internal_processes_store.py"
$routesPath = Join-Path $appDir "routes_internal_processes.py"
$mainPath   = Join-Path $appDir "main.py"

if (!(Test-Path $mainPath)) {
    throw "main.py not found at $mainPath"
}

Backup-IfExists -Path $storePath
Backup-IfExists -Path $routesPath
Backup-IfExists -Path $mainPath

# =========================
# internal_processes_store.py
# =========================

$storeContent = @"
from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_LOCK = threading.Lock()

_base_dir = Path(__file__).resolve().parent.parent / "data"
_defs_path = Path(os.getenv("PROCESS_DEFINITIONS_PATH", str(_base_dir / "process_definitions.json")))
_instances_path = Path(os.getenv("PROCESS_INSTANCES_PATH", str(_base_dir / "process_instances.json")))


def _load_json(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict)]
    except Exception:
        return []


def _save_json(path: Path, items: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    tmp_path.replace(path)


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _gen_id(prefix: str) -> str:
    return f"{prefix}_{int(datetime.utcnow().timestamp())}"


# ---- Process definitions ----

def list_definitions() -> List[Dict[str, Any]]:
    with _LOCK:
        return _load_json(_defs_path)


def get_definition(def_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        items = _load_json(_defs_path)
        for item in items:
            if str(item.get("id")) == str(def_id):
                return item
    return None


def upsert_definition(data: Dict[str, Any]) -> Dict[str, Any]:
    with _LOCK:
        items = _load_json(_defs_path)
        raw_id = data.get("id") or _gen_id("procdef")
        proc_id = str(raw_id)

        now = _now_iso()
        found = None
        for item in items:
            if str(item.get("id")) == proc_id:
                found = item
                break

        if found is None:
            new_item: Dict[str, Any] = {
                "id": proc_id,
                "created_at": now,
            }
            new_item.update(data)
            new_item["updated_at"] = now
            items.append(new_item)
            _save_json(_defs_path, items)
            return new_item

        found.update(data)
        found["id"] = proc_id
        found["updated_at"] = now
        if "created_at" not in found:
            found["created_at"] = now
        _save_json(_defs_path, items)
        return found


def delete_definition(def_id: str) -> bool:
    with _LOCK:
        items = _load_json(_defs_path)
        new_items = [x for x in items if str(x.get("id")) != str(def_id)]
        deleted = len(new_items) != len(items)
        if deleted:
            _save_json(_defs_path, new_items)
        return deleted


# ---- Process instances ----

def list_instances(
    client_profile_id: Optional[str] = None,
    definition_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    with _LOCK:
        items = _load_json(_instances_path)
        result: List[Dict[str, Any]] = []
        for item in items:
            if client_profile_id is not None:
                if str(item.get("client_profile_id")) != str(client_profile_id):
                    continue
            if definition_id is not None:
                if str(item.get("definition_id")) != str(definition_id):
                    continue
            result.append(item)
        return result


def get_instance(instance_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        items = _load_json(_instances_path)
        for item in items:
            if str(item.get("id")) == str(instance_id):
                return item
    return None


def upsert_instance(data: Dict[str, Any]) -> Dict[str, Any]:
    with _LOCK:
        items = _load_json(_instances_path)
        raw_id = data.get("id") or _gen_id("procinst")
        inst_id = str(raw_id)

        now = _now_iso()
        found = None
        for item in items:
            if str(item.get("id")) == inst_id:
                found = item
                break

        if found is None:
            new_item: Dict[str, Any] = {
                "id": inst_id,
                "created_at": now,
            }
            new_item.update(data)
            new_item["updated_at"] = now
            items.append(new_item)
            _save_json(_instances_path, items)
            return new_item

        found.update(data)
        found["id"] = inst_id
        found["updated_at"] = now
        if "created_at" not in found:
            found["created_at"] = now
        _save_json(_instances_path, items)
        return found


def delete_instance(instance_id: str) -> bool:
    with _LOCK:
        items = _load_json(_instances_path)
        new_items = [x for x in items if str(item.get("id")) != str(instance_id)]
        deleted = len(new_items) != len(items)
        if deleted:
            _save_json(_instances_path, new_items)
        return deleted
"@

Set-Content -Path $storePath -Value $storeContent -Encoding UTF8
Write-Host "[OK] Written: $storePath"

# =========================
# routes_internal_processes.py
# =========================

$routesContent = @"
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from . import internal_processes_store as store


class ProcessStageTemplate(BaseModel):
    id: Optional[str] = None
    title: str
    order: int = 1
    description: Optional[str] = None
    default_deadline_offset_days: Optional[int] = None


class ProcessDefinitionIn(BaseModel):
    id: Optional[str] = Field(
        default=None,
        description="Process definition id. If missing, backend will generate one.",
    )
    name: str
    description: Optional[str] = None
    scope: Optional[str] = Field(
        default="client",
        description="Scope: client, period, global, etc.",
    )
    period_type: Optional[str] = Field(
        default=None,
        description="Optional: month, quarter, year, custom, etc.",
    )
    stages: Optional[List[ProcessStageTemplate]] = None
    meta: Optional[Dict[str, Any]] = None


class ProcessDefinition(ProcessDefinitionIn):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProcessStageInstance(BaseModel):
    id: Optional[str] = None
    title: str
    order: int = 1
    status: str = "pending"
    description: Optional[str] = None
    deadline: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class ProcessInstanceIn(BaseModel):
    id: Optional[str] = None
    definition_id: str
    client_profile_id: Optional[str] = None
    period_key: Optional[str] = Field(
        default=None,
        description="For example: 2025-11, 2025-Q4, etc.",
    )
    status: str = "planned"
    stages: Optional[List[ProcessStageInstance]] = None
    meta: Optional[Dict[str, Any]] = None


class ProcessInstance(ProcessInstanceIn):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProcessDefinitionResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    item: Optional[ProcessDefinition] = None


class ProcessDefinitionListResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    items: List[ProcessDefinition]


class ProcessInstanceResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    item: Optional[ProcessInstance] = None


class ProcessInstanceListResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    items: List[ProcessInstance]


router = APIRouter(
    prefix="/api/internal",
    tags=["internal_processes"],
)


@router.get("/process-definitions", response_model=ProcessDefinitionListResponse)
async def list_process_definitions() -> ProcessDefinitionListResponse:
    try:
        raw_items = store.list_definitions()
        items = [ProcessDefinition(**item) for item in raw_items]
        return ProcessDefinitionListResponse(ok=True, items=items, error=None)
    except Exception as exc:
        return ProcessDefinitionListResponse(ok=False, items=[], error=str(exc))


@router.get("/process-definitions/{definition_id}", response_model=ProcessDefinitionResponse)
async def get_process_definition(definition_id: str) -> ProcessDefinitionResponse:
    try:
        raw = store.get_definition(definition_id)
        if raw is None:
            return ProcessDefinitionResponse(
                ok=False,
                error="Process definition not found",
                item=None,
            )
        return ProcessDefinitionResponse(ok=True, error=None, item=ProcessDefinition(**raw))
    except Exception as exc:
        return ProcessDefinitionResponse(ok=False, error=str(exc), item=None)


@router.post("/process-definitions", response_model=ProcessDefinitionResponse)
async def create_process_definition(payload: ProcessDefinitionIn) -> ProcessDefinitionResponse:
    try:
        data = payload.dict(exclude_unset=True)
        stored = store.upsert_definition(data)
        return ProcessDefinitionResponse(ok=True, error=None, item=ProcessDefinition(**stored))
    except Exception as exc:
        return ProcessDefinitionResponse(ok=False, error=str(exc), item=None)


@router.put("/process-definitions/{definition_id}", response_model=ProcessDefinitionResponse)
async def update_process_definition(
    definition_id: str,
    payload: ProcessDefinitionIn,
) -> ProcessDefinitionResponse:
    try:
        existing = store.get_definition(definition_id)
        if existing is None:
            return ProcessDefinitionResponse(
                ok=False,
                error="Process definition not found",
                item=None,
            )
        data = existing.copy()
        data.update(payload.dict(exclude_unset=True))
        data["id"] = definition_id
        stored = store.upsert_definition(data)
        return ProcessDefinitionResponse(ok=True, error=None, item=ProcessDefinition(**stored))
    except Exception as exc:
        return ProcessDefinitionResponse(ok=False, error=str(exc), item=None)


@router.delete("/process-definitions/{definition_id}", response_model=ProcessDefinitionResponse)
async def delete_process_definition(definition_id: str) -> ProcessDefinitionResponse:
    try:
        deleted = store.delete_definition(definition_id)
        if not deleted:
            return ProcessDefinitionResponse(
                ok=False,
                error="Process definition not found",
                item=None,
            )
        return ProcessDefinitionResponse(ok=True, error=None, item=None)
    except Exception as exc:
        return ProcessDefinitionResponse(ok=False, error=str(exc), item=None)


@router.get("/process-instances", response_model=ProcessInstanceListResponse)
async def list_process_instances(
    client_profile_id: Optional[str] = Query(default=None),
    definition_id: Optional[str] = Query(default=None),
) -> ProcessInstanceListResponse:
    try:
        raw_items = store.list_instances(
            client_profile_id=client_profile_id,
            definition_id=definition_id,
        )
        items = [ProcessInstance(**item) for item in raw_items]
        return ProcessInstanceListResponse(ok=True, items=items, error=None)
    except Exception as exc:
        return ProcessInstanceListResponse(ok=False, items=[], error=str(exc))


@router.get("/process-instances/{instance_id}", response_model=ProcessInstanceResponse)
async def get_process_instance(instance_id: str) -> ProcessInstanceResponse:
    try:
        raw = store.get_instance(instance_id)
        if raw is None:
            return ProcessInstanceResponse(
                ok=False,
                error="Process instance not found",
                item=None,
            )
        return ProcessInstanceResponse(ok=True, error=None, item=ProcessInstance(**raw))
    except Exception as exc:
        return ProcessInstanceResponse(ok=False, error=str(exc), item=None)


@router.post("/process-instances", response_model=ProcessInstanceResponse)
async def create_process_instance(payload: ProcessInstanceIn) -> ProcessInstanceResponse:
    try:
        data = payload.dict(exclude_unset=True)
        stored = store.upsert_instance(data)
        return ProcessInstanceResponse(ok=True, error=None, item=ProcessInstance(**stored))
    except Exception as exc:
        return ProcessInstanceResponse(ok=False, error=str(exc), item=None)


@router.put("/process-instances/{instance_id}", response_model=ProcessInstanceResponse)
async def update_process_instance(
    instance_id: str,
    payload: ProcessInstanceIn,
) -> ProcessInstanceResponse:
    try:
        existing = store.get_instance(instance_id)
        if existing is None:
            return ProcessInstanceResponse(
                ok=False,
                error="Process instance not found",
                item=None,
            )
        data = existing.copy()
        data.update(payload.dict(exclude_unset=True))
        data["id"] = instance_id
        stored = store.upsert_instance(data)
        return ProcessInstanceResponse(ok=True, error=None, item=ProcessInstance(**stored))
    except Exception as exc:
        return ProcessInstanceResponse(ok=False, error=str(exc), item=None)


@router.delete("/process-instances/{instance_id}", response_model=ProcessInstanceResponse)
async def delete_process_instance(instance_id: str) -> ProcessInstanceResponse:
    try:
        deleted = store.delete_instance(instance_id)
        if not deleted:
            return ProcessInstanceResponse(
                ok=False,
                error="Process instance not found",
                item=None,
            )
        return ProcessInstanceResponse(ok=True, error=None, item=None)
    except Exception as exc:
        return ProcessInstanceResponse(ok=False, error=str(exc), item=None)
"@

Set-Content -Path $routesPath -Value $routesContent -Encoding UTF8
Write-Host "[OK] Written: $routesPath"

# =========================
# Patch main.py
# =========================

$appendContent = @"
# Internal processes router auto-wiring (safe mode)
try:
    from .routes_internal_processes import router as internal_processes_router  # type: ignore
    app.include_router(internal_processes_router)
except Exception as e:  # pragma: no cover
    import logging
    logging.getLogger("erpv2").warning(
        "Failed to register internal_processes router: %s",
        e,
    )
"@

Add-Content -Path $mainPath -Value $appendContent -Encoding UTF8
Write-Host "[OK] Patched main.py: internal_processes router wired"

Write-Host "== Done. You can now rebuild backend and call /api/internal/* =="
