from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

router = APIRouter(
  prefix="/api/internal/control-events-store",
  tags=["internal-control-events-store"],
)

# -------------------------------
# Strict, file-format-exact loader
# -------------------------------

BASE_DIR = Path(__file__).resolve().parents[2]
STORE_PATH = BASE_DIR / "control_events_store.json"
TEMPLATES_PATH = BASE_DIR / "control_events_templates_store.json"


def _load_json(path: Path) -> Any:
  if not path.exists():
    return None
  try:
    with path.open("r", encoding="utf-8") as f:
      return json.load(f)
  except Exception:
    return None


def _load_events_strict() -> List[Dict[str, Any]]:
  """
  Strict loader based on REAL file format:
  {
    "events": [ {...}, {...}, ... ]
  }
  """
  data = _load_json(STORE_PATH)
  if not isinstance(data, dict):
    return []
  events = data.get("events")
  if not isinstance(events, list):
    return []
  # Filter only dict events
  return [e for e in events if isinstance(e, dict)]


def _load_explicit_templates() -> List[Dict[str, Any]]:
  """
  If user manually created control_events_templates_store.json – we use it.
  """
  data = _load_json(TEMPLATES_PATH)
  if not isinstance(data, dict) and not isinstance(data, list):
    return []

  # Accept same format as events
  if isinstance(data, dict):
    items = data.get("templates") or data.get("items") or data.get("events")
    if isinstance(items, list):
      return [t for t in items if isinstance(t, dict)]

  if isinstance(data, list):
    return [t for t in data if isinstance(t, dict)]

  return []


def _build_templates(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
  """
  Build unique templates based on event `type`.
  """
  by_type: Dict[str, Dict[str, Any]] = {}

  for e in events:
    t = (e.get("type") or "").strip()
    if not t:
      continue

    if t not in by_type:
      by_type[t] = {
        "type": t,
        "code": t,  # backend unified field
        "label": e.get("label") or t,
        "category": e.get("category") or "general",
        "default_status": e.get("status") or "new",
      }

  return list(by_type.values())


@router.get("/", summary="Get internal control event templates store")
def get_internal_control_events_store() -> List[Dict[str, Any]]:
  # 1) explicit templates, if exist
  explicit = _load_explicit_templates()
  if explicit:
    return explicit

  # 2) derive templates from events exactly as in real store
  events = _load_events_strict()
  if not events:
    return []

  return _build_templates(events)
