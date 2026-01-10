from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException

router = APIRouter(prefix="/api/internal/client-profiles", tags=["internal-client-profiles"])

_LOCK = threading.Lock()


def _data_file() -> Path:
    # Store data inside backend repo (persisted with project files)
    base = Path(__file__).resolve().parent  # .../app
    data_dir = base / "_data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "client_profiles_v1.json"


def _load_all() -> Dict[str, Any]:
    p = _data_file()
    if not p.exists():
        return {}
    try:
        raw = p.read_text(encoding="utf-8")
        if not raw.strip():
            return {}
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        # If file is corrupt, do not crash the API
        return {}


def _atomic_write_json(path: Path, obj: Dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    txt = json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True)
    tmp.write_text(txt, encoding="utf-8")
    tmp.replace(path)


@router.get("/{client_code}")
def get_profile(client_code: str) -> Dict[str, Any]:
    code = (client_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="client_code is required")

    with _LOCK:
        allp = _load_all()
        cur = allp.get(code)

    if isinstance(cur, dict):
        out = dict(cur)
        out.setdefault("client_code", code)
        out.setdefault("id", code)
        return out

    return {"client_code": code, "id": code}


@router.put("/{client_code}")
def put_profile(client_code: str, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    code = (client_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="client_code is required")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be an object")

    # Enforce path code as source of truth
    data = dict(payload)
    data["client_code"] = code
    data["id"] = code

    with _LOCK:
        allp = _load_all()
        allp[code] = data
        _atomic_write_json(_data_file(), allp)

    return data
