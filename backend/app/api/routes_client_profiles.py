import json
import uuid
import logging
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

CLIENT_PROFILES_STORE = "client_profiles_store.json"

# Project root (same pattern as in chain_executor_v2)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORE_PATH = BASE_DIR / CLIENT_PROFILES_STORE

router = APIRouter(
    prefix="/api/internal",
    tags=["internal.client_profiles"],
)


def _load_profiles() -> Dict[str, Any]:
    """
    Load client profiles from JSON store.
    Expected structure:
      { "profiles": [ {...}, {...} ] }
    """
    if not STORE_PATH.exists():
        logger.info("Client profiles store not found at %s, using empty list", STORE_PATH)
        return {"profiles": []}

    try:
        with STORE_PATH.open("r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except Exception as exc:
        logger.exception("Failed to load client profiles store %s: %s", STORE_PATH, exc)
        return {"profiles": []}

    if isinstance(data, dict) and isinstance(data.get("profiles"), list):
        return data

    logger.warning("Client profiles store has invalid structure, using empty list")
    return {"profiles": []}


def _save_profiles(data: Dict[str, Any]) -> None:
    """
    Save client profiles to JSON store with stable UTF-8 encoding.
    """
    try:
        with STORE_PATH.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        logger.exception("Failed to save client profiles store %s: %s", STORE_PATH, exc)
        raise


@router.get("/client-profiles")
def list_profiles() -> List[Dict[str, Any]]:
    store = _load_profiles()
    return store.get("profiles", [])


@router.post("/client-profiles")
def create_profile(payload: Dict[str, Any]) -> Dict[str, Any]:
    code = payload.get("code")
    label = payload.get("label")

    if not code or not label:
        raise HTTPException(status_code=400, detail="Missing required fields")

    store = _load_profiles()
    profiles = store.get("profiles", [])

    for p in profiles:
        if p.get("code") == code:
            raise HTTPException(status_code=409, detail="Profile already exists")

    new_profile = {
        "id": str(uuid.uuid4()),
        "code": code,
        "label": label,
        "profile_type": payload.get("profile_type", "default"),
        "salary_dates": payload.get("salary_dates", []),
        "has_tourist_tax": payload.get("has_tourist_tax", False),
        "settings": payload.get("settings", {}),
    }

    profiles.append(new_profile)
    store["profiles"] = profiles
    _save_profiles(store)

    return new_profile
