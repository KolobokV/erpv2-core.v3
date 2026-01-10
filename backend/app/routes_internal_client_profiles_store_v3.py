from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException

router = APIRouter(prefix="/api/internal/client-profiles", tags=["internal_client_profiles"])

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "_data")
STORE_FILE = os.path.join(DATA_DIR, "client_profiles_store_v3.json")


def _now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _ensure_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def _load_store() -> Dict[str, Dict[str, Any]]:
    _ensure_dir()
    if not os.path.exists(STORE_FILE):
        return {}
    try:
        with open(STORE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            out: Dict[str, Dict[str, Any]] = {}
            for k, v in data.items():
                if isinstance(k, str) and isinstance(v, dict):
                    out[k] = v
            return out
    except Exception:
        return {}
    return {}


def _save_store(store: Dict[str, Dict[str, Any]]) -> None:
    _ensure_dir()
    tmp = STORE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2, sort_keys=True)
    os.replace(tmp, STORE_FILE)


def _normalize_code(code: str) -> str:
    return str(code or "").strip()


def _default_profile(code: str) -> Dict[str, Any]:
    code0 = _normalize_code(code)
    return {
        "client_code": code0,
        "id": code0,
        "code": code0,
        "label": code0,
        "profile_type": "default",
        "tax_system": "",
        "salary_dates": {},
        "has_tourist_tax": False,
        "contact_email": "",
        "contact_phone": "",
        "contact_person": "",
        "settings": {},
        "updated_at": _now_iso(),
    }


def _merge_profile(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)

    # simple top-level fields
    for k in ["tax_system", "profile_type", "label", "has_tourist_tax", "contact_email", "contact_phone", "contact_person"]:
        if k in patch:
            out[k] = patch.get(k)

    # salary_dates must be object
    if "salary_dates" in patch and isinstance(patch.get("salary_dates"), dict):
        out["salary_dates"] = patch.get("salary_dates")

    # settings merge
    if "settings" in patch and isinstance(patch.get("settings"), dict):
        cur = out.get("settings")
        cur = cur if isinstance(cur, dict) else {}
        merged = dict(cur)
        for sk, sv in patch.get("settings", {}).items():
            merged[sk] = sv
        out["settings"] = merged

    # fallback: allow contact_* inside settings
    st = out.get("settings")
    if isinstance(st, dict):
        if not out.get("contact_email") and isinstance(st.get("contact_email"), str):
            out["contact_email"] = st.get("contact_email")
        if not out.get("contact_phone") and isinstance(st.get("contact_phone"), str):
            out["contact_phone"] = st.get("contact_phone")
        if not out.get("contact_person") and isinstance(st.get("contact_person"), str):
            out["contact_person"] = st.get("contact_person")

    out["updated_at"] = _now_iso()
    return out


@router.get("/{client_code}")
def get_client_profile(client_code: str):
    code = _normalize_code(client_code)
    if not code:
        raise HTTPException(status_code=400, detail="client_code is required")
    store = _load_store()
    prof = store.get(code) or _default_profile(code)

    # Ensure required identity fields
    prof["client_code"] = code
    prof["id"] = code
    prof["code"] = code
    if not prof.get("label"):
        prof["label"] = code

    return prof


@router.put("/{client_code}")
def put_client_profile(client_code: str, body: Dict[str, Any] = Body(default={})):
    code = _normalize_code(client_code)
    if not code:
        raise HTTPException(status_code=400, detail="client_code is required")

    store = _load_store()
    cur = store.get(code) or _default_profile(code)

    # If body provides a different client_code, ignore it and use path param
    body = dict(body or {})
    body.pop("client_code", None)
    body.pop("id", None)
    body.pop("code", None)

    nxt = _merge_profile(cur, body)
    nxt["client_code"] = code
    nxt["id"] = code
    nxt["code"] = code
    if not nxt.get("label"):
        nxt["label"] = code

    store[code] = nxt
    _save_store(store)
    return nxt
