import json
import uuid
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

# This router provides a minimal internal API for client profiles.
# IMPORTANT:
# - Keep it dependency-free (no imports from optional modules), so backend can always boot.
# - Store format is a simple JSON list in client_profiles_store.json for compatibility with older dev routes.

CLIENT_PROFILES_STORE = "client_profiles_store.json"

# Project root (same pattern as other store-based routes)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORE_PATH = BASE_DIR / CLIENT_PROFILES_STORE

router = APIRouter(prefix="/api/internal", tags=["internal"])

def _load_json_safe(path: Path, default: Any) -> Any:
    try:
        if not path.exists():
            return default
        txt = path.read_text(encoding="utf-8")
        if not txt.strip():
            return default
        return json.loads(txt)
    except Exception as e:
        logger.exception("Failed to load json store: %s (%s)", str(path), str(e))
        return default

def _save_json_safe(path: Path, data: Any) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.exception("Failed to save json store: %s (%s)", str(path), str(e))
        raise

def _normalize_store(raw: Any) -> List[Dict[str, Any]]:
    # historical formats supported:
    # - list[profile]
    # - {"profiles": list[profile]}
    if isinstance(raw, list):
        return [p for p in raw if isinstance(p, dict)]
    if isinstance(raw, dict) and isinstance(raw.get("profiles"), list):
        return [p for p in raw["profiles"] if isinstance(p, dict)]
    return []

def _persist_profiles(profiles: List[Dict[str, Any]]) -> None:
    # keep simplest list format
    _save_json_safe(STORE_PATH, profiles)

def _make_profile(payload: Dict[str, Any]) -> Dict[str, Any]:
    code = str(payload.get("code") or payload.get("client_code") or payload.get("clientId") or "").strip()
    label = str(payload.get("label") or payload.get("name") or payload.get("client_label") or code).strip()
    if not code:
        raise HTTPException(status_code=400, detail="code_required")

    return {
        "id": str(uuid.uuid4()),
        "code": code,
        "label": label or code,
        "profile_type": str(payload.get("profile_type") or payload.get("type") or "default"),
        "salary_dates": payload.get("salary_dates") if isinstance(payload.get("salary_dates"), list) else [],
        "has_tourist_tax": bool(payload.get("has_tourist_tax") or payload.get("tourismTax") or False),
        "settings": payload.get("settings") if isinstance(payload.get("settings"), dict) else {},
    }

@router.get("/client-profiles")
def list_client_profiles() -> List[Dict[str, Any]]:
    raw = _load_json_safe(STORE_PATH, [])
    return _normalize_store(raw)

@router.post("/client-profiles")
def create_client_profile(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw = _load_json_safe(STORE_PATH, [])
    profiles = _normalize_store(raw)

    new_profile = _make_profile(payload)

    # de-dup by code
    profiles = [p for p in profiles if str(p.get("code") or "").strip() != new_profile["code"]]
    profiles.append(new_profile)

    _persist_profiles(profiles)
    return new_profile

@router.put("/client-profiles/{code}")
def upsert_client_profile(code: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    code_norm = str(code or "").strip()
    if not code_norm:
        raise HTTPException(status_code=400, detail="code_required")

    raw = _load_json_safe(STORE_PATH, [])
    profiles = _normalize_store(raw)

    # find existing
    idx = -1
    for i, p in enumerate(profiles):
        if str(p.get("code") or "").strip() == code_norm:
            idx = i
            break

    if idx >= 0:
        existing = profiles[idx]
        merged = dict(existing)
        # allow updating label/settings flags
        if "label" in payload or "name" in payload:
            merged["label"] = str(payload.get("label") or payload.get("name") or merged.get("label") or code_norm)
        if isinstance(payload.get("settings"), dict):
            merged["settings"] = payload["settings"]
        if isinstance(payload.get("salary_dates"), list):
            merged["salary_dates"] = payload["salary_dates"]
        if "has_tourist_tax" in payload or "tourismTax" in payload:
            merged["has_tourist_tax"] = bool(payload.get("has_tourist_tax") or payload.get("tourismTax"))
        profiles[idx] = merged
        _persist_profiles(profiles)
        return merged

    # create new if not found
    new_payload = dict(payload)
    new_payload["code"] = code_norm
    new_profile = _make_profile(new_payload)
    profiles.append(new_profile)
    _persist_profiles(profiles)
    return new_profile
