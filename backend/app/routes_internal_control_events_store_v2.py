from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter

router = APIRouter(
  prefix="/api/internal/control-events-store-v2",
  tags=["internal-control-events-store-v2"],
)

logger = logging.getLogger("erpv2.internal_control_events_store_v2")


def _candidate_paths(filename: str) -> List[Path]:
  """
  Build a list of candidate paths by climbing up from this file.

  IMPORTANT: parents are iterated from outer to inner (reversed),
  so project roots are preferred over inner app/api folders.
  """
  here = Path(__file__).resolve()
  parents_reversed = list(here.parents)[::-1]
  return [parent / filename for parent in parents_reversed]


def _find_store_file(filename: str) -> Optional[Path]:
  """
  Return first existing `<parent>/filename` from reversed parents list.
  """
  candidates = _candidate_paths(filename)
  for candidate in candidates:
    if candidate.exists():
      logger.info("CONTROL_EVENTS_V2: using %s", candidate)
      return candidate
  logger.warning("CONTROL_EVENTS_V2: file %s not found in any parent", filename)
  return None


def _load_json(path: Optional[Path]) -> Any:
  if path is None:
    return None
  if not path.exists():
    logger.warning("CONTROL_EVENTS_V2: path %s does not exist", path)
    return None
  try:
    with path.open("r", encoding="utf-8") as f:
      data = json.load(f)
    logger.info("CONTROL_EVENTS_V2: loaded JSON from %s (type=%s)", path, type(data))
    return data
  except Exception as exc:
    logger.warning("CONTROL_EVENTS_V2: failed to load JSON from %s: %s", path, exc)
    return None


def _collect_event_like_dicts(data: Any) -> List[Dict[str, Any]]:
  """
  Recursively walk any JSON structure and collect dicts that *look like*
  control events / templates (have at least one of code/type/label/category/status).
  """
  collected: List[Dict[str, Any]] = []

  def _walk(node: Any) -> None:
    if isinstance(node, dict):
      keys = set(node.keys())
      if keys.intersection({"code", "type", "label", "category", "status"}):
        collected.append(node)
      for v in node.values():
        _walk(v)
    elif isinstance(node, list):
      for item in node:
        _walk(item)

  _walk(data)
  return collected


def _load_events() -> List[Dict[str, Any]]:
  """
  Prefer strict real format:
      { "events": [ {...}, {...} ] }
  Fallback: recursive scan for event-like dicts.
  """
  store_path = _find_store_file("control_events_store.json")
  data = _load_json(store_path)
  if data is None:
    logger.info("CONTROL_EVENTS_V2: no data loaded from control_events_store.json")
    return []

  # Strict path: dict with "events": list
  if isinstance(data, dict):
    events_val = data.get("events")
    if isinstance(events_val, list):
      events = [e for e in events_val if isinstance(e, dict)]
      logger.info("CONTROL_EVENTS_V2: strict events list -> %d events", len(events))
      if events:
        return events

  # Fallback: collect event-like dicts anywhere in JSON
  fallback_events = _collect_event_like_dicts(data)
  logger.info("CONTROL_EVENTS_V2: fallback events -> %d events", len(fallback_events))
  return fallback_events


def _build_templates(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
  """
  Build unique templates based on event type.
  """
  by_type: Dict[str, Dict[str, Any]] = {}

  for e in events:
    t = (e.get("type") or e.get("code") or "").strip()
    if not t:
      continue

    if t not in by_type:
      by_type[t] = {
        "type": t,
        "code": t,
        "label": e.get("label") or e.get("name") or t,
        "category": e.get("category") or "general",
        "default_status": e.get("status") or e.get("default_status") or "new",
      }

  logger.info(
    "CONTROL_EVENTS_V2: built %d templates from %d events",
    len(by_type),
    len(events),
  )
  return list(by_type.values())


@router.get("/", summary="Get internal control event templates (v2)")
def get_internal_control_events_store_v2() -> List[Dict[str, Any]]:
  events = _load_events()
  if not events:
    logger.info("CONTROL_EVENTS_V2: no events found, returning empty list")
    return []
  templates = _build_templates(events)
  return templates


@router.get("/debug", summary="Debug info for control events store v2")
def get_internal_control_events_store_v2_debug() -> Dict[str, Any]:
  """
  Return diagnostic information:
    - candidate paths (outer to inner)
    - chosen path
    - basic info about loaded JSON
    - event counts (strict / fallback)
    - template count
  """
  candidates = [str(p) for p in _candidate_paths("control_events_store.json")]
  chosen_path = _find_store_file("control_events_store.json")
  chosen_str = str(chosen_path) if chosen_path is not None else None

  data = _load_json(chosen_path)
  if data is None:
    return {
      "candidates": candidates,
      "chosen_path": chosen_str,
      "data_type": None,
      "data_keys": None,
      "strict_events_count": 0,
      "fallback_events_count": 0,
      "templates_count": 0,
    }

  if isinstance(data, dict):
    strict_events_val = data.get("events")
    if isinstance(strict_events_val, list):
      strict_events = [e for e in strict_events_val if isinstance(e, dict)]
    else:
      strict_events = []
  else:
    strict_events = []

  fallback_events = _collect_event_like_dicts(data)
  templates = _build_templates(fallback_events if fallback_events else strict_events)

  return {
    "candidates": candidates,
    "chosen_path": chosen_str,
    "data_type": type(data).__name__,
    "data_keys": list(data.keys()) if isinstance(data, dict) else None,
    "strict_events_count": len(strict_events),
    "fallback_events_count": len(fallback_events),
    "templates_count": len(templates),
  }
