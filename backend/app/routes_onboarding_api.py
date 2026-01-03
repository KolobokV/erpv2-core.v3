from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

@router.post("/derive-preview", summary="Derive preview (stub compat endpoint)")
def derive_preview(payload: Dict[str, Any]) -> Dict[str, Any]:
    # Placeholder for future onboarding pipeline.
    return {"status": "ok", "preview": {}, "input": payload}
