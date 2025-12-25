from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

_LOCK = threading.Lock()

_default_path = (
    Path(__file__).resolve().parent.parent
    / "data"
    / "client_profiles.json"
)

FILE_PATH = Path(os.getenv("CLIENT_PROFILES_PATH", str(_default_path)))


def _load_raw() -> List[Dict[str, Any]]:
    if not FILE_PATH.exists():
        return []
    try:
        with FILE_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict)]
    except Exception:
        # In safe mode we never propagate errors up
        return []


def _save_raw(items: List[Dict[str, Any]]) -> None:
    FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = FILE_PATH.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    tmp_path.replace(FILE_PATH)


def list_profiles() -> List[Dict[str, Any]]:
    with _LOCK:
        return _load_raw()


def get_profile(profile_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        items = _load_raw()
        for item in items:
            if str(item.get("id")) == str(profile_id):
                return item
    return None


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def upsert_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    with _LOCK:
        items = _load_raw()

        raw_id = data.get("id")
        if not raw_id:
            raw_id = f"cli_{int(datetime.utcnow().timestamp())}"
        profile_id = str(raw_id)

        found = None
        for item in items:
            if str(item.get("id")) == profile_id:
                found = item
                break

        now = _now_iso()

        if found is None:
            # create new
            new_item: Dict[str, Any] = {
                "id": profile_id,
                "created_at": now,
            }
            new_item.update(data)
            new_item["updated_at"] = now
            items.append(new_item)
            _save_raw(items)
            return new_item

        # update existing
        found.update(data)
        found["id"] = profile_id
        found["updated_at"] = now
        if "created_at" not in found:
            found["created_at"] = now
        _save_raw(items)
        return found


def delete_profile(profile_id: str) -> bool:
    with _LOCK:
        items = _load_raw()
        new_items = [x for x in items if str(x.get("id")) != str(profile_id)]
        deleted = len(new_items) != len(items)
        if deleted:
            _save_raw(new_items)
        return deleted
