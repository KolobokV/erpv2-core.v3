from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="", tags=["internal-dev"])


def _project_root() -> Path:
    # app/internal_dev_api.py -> app -> project root
    return Path(__file__).resolve().parent.parent


def _read_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(str(path))
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        return []
    return json.loads(raw)


def _load_first_existing(names: List[str]) -> Tuple[str, Any]:
    root = _project_root()
    last_err: str = ""
    for name in names:
        p = root / name
        try:
            return name, _read_json(p)
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            continue
    raise HTTPException(status_code=404, detail=f"Store not found. Last error: {last_err}")


def _as_list(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return payload  # type: ignore[return-value]
    if isinstance(payload, dict):
        for k in ["value", "items", "data", "results"]:
            v = payload.get(k)
            if isinstance(v, list):
                return v  # type: ignore[return-value]
    return []


@router.get("/client-profiles")
def client_profiles() -> Dict[str, Any]:
    _, payload = _load_first_existing(["client_profiles_store.json"])
    items = _as_list(payload)
    return {"value": items, "Count": len(items)}


@router.get("/tasks")
def tasks() -> Any:
    # Prefer tasks.json (often generated), fallback to tasks_store.json
    _, payload = _load_first_existing(["tasks.json", "tasks_store.json"])
    return payload


@router.get("/process-instances-v2")
def process_instances_v2() -> Any:
    _, payload = _load_first_existing(["process_instances_store.json"])
    return payload


@router.get("/control-events-store-v2")
def control_events_store_v2() -> Any:
    _, payload = _load_first_existing(["control_events_store.json"])
    return payload


@router.get("/control-events-store")
def control_events_store() -> Any:
    _, payload = _load_first_existing(["control_events_store.json"])
    return payload


@router.get("/process-chains/dev")
def process_chains_dev() -> Any:
    _, payload = _load_first_existing(["process_chains_store.json"])
    return payload
