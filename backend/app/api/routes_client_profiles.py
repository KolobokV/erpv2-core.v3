import uuid
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException

from app.core.store_json import load_json_store, save_json_store

CLIENT_PROFILES_STORE = "client_profiles_store.json"

router = APIRouter(
    prefix="/api/internal",
    tags=["internal.client_profiles"]
)


def _load_profiles() -> Dict[str, Any]:
    data = load_json_store(CLIENT_PROFILES_STORE, default={"profiles": []})
    if isinstance(data, dict) and isinstance(data.get("profiles"), list):
        return data
    return {"profiles": []}


def _save_profiles(data: Dict[str, Any]) -> None:
    save_json_store(CLIENT_PROFILES_STORE, data)


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
