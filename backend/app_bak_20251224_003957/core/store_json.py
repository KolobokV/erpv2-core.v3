import json
from pathlib import Path
from typing import Any, Dict, TypeVar

T = TypeVar("T")

# This file lives in app/core/store_json.py
# BASE_DIR points to ERPv2_backend_connect root (where JSON stores are placed).
BASE_DIR = Path(__file__).resolve().parents[2]


def get_store_path(name: str) -> Path:
    """
    Resolve store file path by name.
    Example: "process_instances_store.json"
    """
    return BASE_DIR / name


def load_json_store(name: str, default: T) -> T:
    """
    Load JSON store by name. If file is missing or invalid, return default.
    """
    path = get_store_path(name)
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)  # type: ignore[return-value]
    except Exception:
        # If file is broken, do not crash API, just return default.
        return default


def save_json_store(name: str, data: Any) -> None:
    """
    Save JSON store by name. Creates file if needed.
    """
    path = get_store_path(name)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
