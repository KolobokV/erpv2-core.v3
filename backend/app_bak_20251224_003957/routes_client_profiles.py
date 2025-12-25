import json
import os
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")

CANDIDATE_PATHS = [
    os.path.join(BASE_DIR, "client_profiles.json"),
    os.path.join(DATA_DIR, "client_profiles.json"),
]


def _load_profiles() -> List[Dict[str, Any]]:
    for path in CANDIDATE_PATHS:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and "items" in data:
                return data["items"]
            if isinstance(data, list):
                return data
    return []


router = APIRouter(prefix="/client-profiles", tags=["client-profiles"])


@router.get("")
def list_client_profiles():
    """
    GET /api/internal/client-profiles
    """
    items = _load_profiles()
    return {"items": items}


@router.get("/{client_id}")
def get_client_profile(client_id: str):
    """
    GET /api/internal/client-profiles/{client_id}
    """
    items = _load_profiles()
    for p in items:
        pid = str(p.get("id") or p.get("client_id") or "")
        if pid == client_id:
            return p
    raise HTTPException(status_code=404, detail="Client profile not found")
