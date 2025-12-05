from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter

from app.core.chain_registry import list_registered_chains

router = APIRouter(prefix="/api/internal/chains", tags=["internal_chains"])


@router.get("/registered")
def get_registered_chains() -> Dict[str, Any]:
    """
    Return list of registered chains from the in-memory registry.

    Response format:
    {
        "items": [
            {"id": "debug.log"},
            {"id": "reglament.ip_usn_dr.monthly"},
            ...
        ]
    }
    """
    registry = list_registered_chains()
    items: List[Dict[str, str]] = []

    for chain_id in sorted(registry.keys()):
        items.append({"id": chain_id})

    return {"items": items}
