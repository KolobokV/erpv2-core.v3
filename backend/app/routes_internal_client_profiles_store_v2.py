from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException

router = APIRouter(prefix="/api/internal/client-profiles", tags=["internal-client-profiles"])

_LOCK = threading.Lock()


def _app_root() -> Path:
    return Path(__file__).resolve().parent


def _data_dir() -> Path:
    return _app_root() / "data"


def _data_file() -> Path:
    return _data_dir() / "internal_client_profiles_store.json"


def _ensure_dirs() -> None:
    _data_dir().mkdir(parents=True, exist_ok=True)


def _load_all() -> Dict[str, Any]:
    p = _data_file()
    if not p.exists():
        return {}
    try:
        obj = json.loads(p.read_text(encoding="utf-8"))
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def _atomic_write(path: Path, obj: Any) -> None:
    _ensure_dirs()
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(path))


def _default_profile(code: str) -> Dict[str, Any]:
    return {
        "client_code": code,
        "id": code,
        "code": code,
        "label": code,
        "profile_type": "default",
        "tax_system": "",
        "salary_dates": {},
        "has_tourist_tax": False,
        "settings": {},
    }


def _merge(base: Dict[str, Any], patch: Dict[str, Any], code: str) -> Dict[str, Any]:
    out = dict(base)

    # stable identifiers (path is source of truth)
    out["client_code"] = code
    out["id"] = code
    out["code"] = code

    # allow "name" to populate label if label empty
    if "label" in patch and patch["label"] is not None:
        out["label"] = patch["label"]
    if "name" in patch and patch["name"] is not None and not out.get("label"):
        out["label"] = patch["name"]

    # common fields
    for k in ["profile_type", "tax_system"]:
        if k in patch and patch[k] is not None:
            out[k] = patch[k]

    if "salary_dates" in patch and patch["salary_dates"] is not None:
        out["salary_dates"] = patch["salary_dates"]
    if "has_tourist_tax" in patch and patch["has_tourist_tax"] is not None:
        out["has_tourist_tax"] = bool(patch["has_tourist_tax"])
    if "settings" in patch and patch["settings"] is not None:
        out["settings"] = patch["settings"]

    # normalize
    if not isinstance(out.get("salary_dates"), dict):
        out["salary_dates"] = {}
    if not isinstance(out.get("settings"), dict):
        out["settings"] = {}
    if not isinstance(out.get("label"), str) or not out.get("label"):
        out["label"] = code
    if not isinstance(out.get("profile_type"), str) or not out.get("profile_type"):
        out["profile_type"] = "default"
    if not isinstance(out.get("tax_system"), str):
        out["tax_system"] = str(out.get("tax_system") or "")

    return out


@router.get("/{client_code}")
def get_client_profile(client_code: str) -> Dict[str, Any]:
    code = (client_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="client_code is empty")

    with _LOCK:
        allp = _load_all()
        cur = allp.get(code)

    if not isinstance(cur, dict):
        return _default_profile(code)

    base = _default_profile(code)
    base.update(cur)
    base["client_code"] = code
    base["id"] = code
    base["code"] = code
    return base


@router.put("/{client_code}")
def put_client_profile(client_code: str, payload: Any = Body(...)) -> Dict[str, Any]:
    code = (client_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="client_code is empty")
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be an object")

    with _LOCK:
        allp = _load_all()
        cur = allp.get(code)
        base = cur if isinstance(cur, dict) else _default_profile(code)
        merged = _merge(base, payload, code)
        allp[code] = merged
        _atomic_write(_data_file(), allp)

    return merged
