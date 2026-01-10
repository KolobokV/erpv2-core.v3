from __future__ import annotations

import json
import os
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/internal/client-profiles", tags=["internal-client-profiles"])

_LOCK = Lock()

_DATA_DIR = Path(__file__).resolve().parent / "data"
_DATA_FILE = _DATA_DIR / "client_profiles_store_v1.json"


def _ensure_paths() -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not _DATA_FILE.exists():
        _DATA_FILE.write_text("{}", encoding="utf-8")


def _load_all() -> Dict[str, Any]:
    _ensure_paths()
    try:
        raw = _DATA_FILE.read_text(encoding="utf-8")
        obj = json.loads(raw) if raw else {}
        if isinstance(obj, dict):
            return obj
    except Exception:
        return {}
    return {}


def _save_all(data: Dict[str, Any]) -> None:
    _ensure_paths()
    tmp = _DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(_DATA_FILE))


class ClientProfileIn(BaseModel):
    client_code: str = Field(..., min_length=1)
    name: Optional[str] = None
    label: Optional[str] = None
    tax_system: Optional[str] = None
    profile_type: Optional[str] = "default"
    salary_dates: Optional[Dict[str, Any]] = None
    has_tourist_tax: Optional[bool] = False
    settings: Optional[Dict[str, Any]] = None


class ClientProfileOut(BaseModel):
    client_code: str
    id: str
    code: str
    label: str
    profile_type: str
    tax_system: Optional[str] = None
    salary_dates: Dict[str, Any] = Field(default_factory=dict)
    has_tourist_tax: bool = False
    settings: Dict[str, Any] = Field(default_factory=dict)


def _normalize(code: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(payload.get("name") or payload.get("label") or code)
    out = {
        "client_code": code,
        "id": code,
        "code": code,
        "label": name,
        "profile_type": str(payload.get("profile_type") or "default"),
        "tax_system": payload.get("tax_system"),
        "salary_dates": payload.get("salary_dates") if isinstance(payload.get("salary_dates"), dict) else {},
        "has_tourist_tax": bool(payload.get("has_tourist_tax") or False),
        "settings": payload.get("settings") if isinstance(payload.get("settings"), dict) else {},
    }
    return out


@router.get("/{client_code}", response_model=ClientProfileOut)
def get_profile(client_code: str) -> Any:
    code = (client_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="client_code is required")

    with _LOCK:
        data = _load_all()
        raw = data.get(code)

    if not raw:
        # Return minimal default; frontend can still render and then PUT.
        return _normalize(code, {"name": code})

    if isinstance(raw, dict):
        return _normalize(code, raw)

    return _normalize(code, {"name": code})


@router.put("/{client_code}", response_model=ClientProfileOut)
def put_profile(client_code: str, body: ClientProfileIn) -> Any:
    code = (client_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="client_code is required")

    payload = body.model_dump() if hasattr(body, "model_dump") else dict(body)
    payload["client_code"] = code

    with _LOCK:
        data = _load_all()
        data[code] = payload
        _save_all(data)

    return _normalize(code, payload)


@router.get("", response_model=Dict[str, ClientProfileOut])
def list_profiles() -> Any:
    with _LOCK:
        data = _load_all()
    out: Dict[str, Any] = {}
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, dict):
                out[k] = _normalize(k, v)
            else:
                out[k] = _normalize(k, {"name": k})
    return out
