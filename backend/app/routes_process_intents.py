"""
Process intent realization endpoint.

Contract:
POST /api/internal/process-intents/realize
Body: { "clientId": "...", "taskKey": "..." }

Idempotent:
- process_key = "{clientId}::{taskKey}"
- if exists -> status="exists"
- else -> create minimal instance in store -> status="created"

Store:
- default: <backend_root>/process_instances_store.json
- override via env: ERP_PROCESS_INSTANCES_STORE
- robust to formats: list / dict(items) / dict(instances)
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/internal/process-intents", tags=["internal-process-intents"])

_LOCK = threading.Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _backend_root() -> str:
    here = os.path.abspath(os.path.dirname(__file__))
    # app/api -> app -> backend_root
    return os.path.abspath(os.path.join(here, "..", "..", ".."))


def _store_path() -> str:
    return os.getenv("ERP_PROCESS_INSTANCES_STORE", os.path.join(_backend_root(), "process_instances_store.json"))


def _read_json(path: str) -> Any:
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _write_json_atomic(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _normalize_store(raw: Any) -> Tuple[str, Union[List[Dict[str, Any]], Dict[str, Any]], Any]:
    """
    Returns (mode, container, original_shape)

    mode:
      - "list": container is list[instance]
      - "items": container is dict mapping process_key -> instance
      - "instances": container is list[instance] stored in dict["instances"]
    """
    if raw is None:
        return ("list", [], None)

    if isinstance(raw, list):
        return ("list", raw, "list")

    if isinstance(raw, dict):
        if isinstance(raw.get("items"), dict):
            return ("items", raw["items"], "dict_items")
        if isinstance(raw.get("instances"), list):
            return ("instances", raw["instances"], "dict_instances")
        # unknown dict shape -> keep as dict_instances style to avoid breaking unknown keys
        raw.setdefault("instances", [])
        if isinstance(raw["instances"], list):
            return ("instances", raw["instances"], "dict_unknown")
        # fallback
        return ("list", [], "dict_bad")

    # fallback
    return ("list", [], "unknown")


def _find_existing_instance(container_mode: str, container: Union[List[Dict[str, Any]], Dict[str, Any]], process_key: str) -> Optional[Dict[str, Any]]:
    if container_mode == "items":
        hit = container.get(process_key)  # type: ignore[union-attr]
        return hit if isinstance(hit, dict) else None

    # list-based
    lst: List[Dict[str, Any]] = container  # type: ignore[assignment]
    for inst in lst:
        if not isinstance(inst, dict):
            continue
        if inst.get("process_key") == process_key:
            return inst
        if inst.get("key") == process_key:
            return inst
    return None


def _upsert_instance(container_mode: str, container: Union[List[Dict[str, Any]], Dict[str, Any]], process_key: str, instance: Dict[str, Any]) -> None:
    if container_mode == "items":
        container[process_key] = instance  # type: ignore[index]
        return

    lst: List[Dict[str, Any]] = container  # type: ignore[assignment]
    for i, inst in enumerate(lst):
        if not isinstance(inst, dict):
            continue
        if inst.get("process_key") == process_key or inst.get("key") == process_key:
            lst[i] = instance
            return
    lst.append(instance)


class IntentIn(BaseModel):
    clientId: str = Field(..., min_length=1)
    taskKey: str = Field(..., min_length=1)


class IntentOut(BaseModel):
    status: str
    instance_id: str
    process_key: str
    clientId: str
    taskKey: str


@router.post("/realize", response_model=IntentOut)
def realize_intent(body: IntentIn) -> IntentOut:
    process_key = f"{body.clientId}::{body.taskKey}"
    path = _store_path()

    with _LOCK:
        raw = _read_json(path)
        mode, container, shape = _normalize_store(raw)

        existing = _find_existing_instance(mode, container, process_key)
        if isinstance(existing, dict):
            existing_id = existing.get("instance_id") or existing.get("id") or existing.get("instanceId")
            if existing_id:
                return IntentOut(
                    status="exists",
                    instance_id=str(existing_id),
                    process_key=process_key,
                    clientId=body.clientId,
                    taskKey=body.taskKey,
                )

        instance_id = str(uuid.uuid4())
        now = _utc_now_iso()

        inst: Dict[str, Any] = {
            "instance_id": instance_id,
            "process_key": process_key,
            "client_id": body.clientId,
            "task_key": body.taskKey,
            "status": "created",
            "created_at": now,
            "updated_at": now,
            "meta": {"source": "intent-realize"},
        }

        _upsert_instance(mode, container, process_key, inst)

        # write back preserving outer dict if present
        if isinstance(raw, dict):
            if mode == "items":
                raw["items"] = container
            elif mode == "instances":
                raw["instances"] = container
            else:
                # list mode but raw dict: store into "instances"
                raw["instances"] = container
            _write_json_atomic(path, raw)
        else:
            _write_json_atomic(path, container)

    return IntentOut(
        status="created",
        instance_id=instance_id,
        process_key=process_key,
        clientId=body.clientId,
        taskKey=body.taskKey,
    )