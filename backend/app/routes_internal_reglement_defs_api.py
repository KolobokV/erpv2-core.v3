from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/internal/reglement", tags=["internal-reglement"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORE_PATH = BASE_DIR / "reglement_defs_store.json"


def _load_store() -> Dict[str, Any]:
    if not STORE_PATH.exists():
        return {"defs": [], "updated_at": None}

    try:
        raw = STORE_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)

        if isinstance(data, list):
            return {"defs": data, "updated_at": None}

        if isinstance(data, dict) and isinstance(data.get("defs"), list):
            return data

        return {"defs": [], "updated_at": None}
    except Exception:
        return {"defs": [], "updated_at": None}


def _save_store(payload: Dict[str, Any]) -> None:
    safe = {"defs": payload.get("defs", []), "updated_at": datetime.utcnow().isoformat()}
    tmp = STORE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(safe, ensure_ascii=True, indent=2), encoding="utf-8")
    tmp.replace(STORE_PATH)


@router.get("/definitions")
def get_definitions() -> Dict[str, Any]:
    return _load_store()


@router.put("/definitions")
def put_definitions(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be object")

    defs = payload.get("defs")
    if defs is None or not isinstance(defs, list):
        raise HTTPException(status_code=400, detail="defs must be list")

    _save_store({"defs": defs})
    return _load_store()
