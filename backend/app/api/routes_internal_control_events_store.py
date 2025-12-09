from typing import List, Dict, Any

from fastapi import APIRouter

from app.core.store_json import load_json_store

CONTROL_EVENTS_TEMPLATES_STORE = "control_events_templates_store.json"
CONTROL_EVENTS_STORE = "control_events_store.json"

router = APIRouter(
    prefix="/api/internal/control-events-store",
    tags=["internal.control_events_store"]
)


def _load_templates_raw() -> Any:
    """
    Load templates store in any legacy format.
    """
    data = load_json_store(CONTROL_EVENTS_TEMPLATES_STORE, default={"templates": []})
    return data


def _load_events_raw() -> Any:
    """
    Load real control events to infer templates if needed.
    """
    data = load_json_store(CONTROL_EVENTS_STORE, default={"events": []})
    return data


def _normalize_templates() -> List[Dict[str, Any]]:
    """
    Return unified list of control event templates.

    Priority:
      1) Explicit templates from control_events_templates_store.json
      2) If none -> infer minimal templates from real events in control_events_store.json
    """
    raw = _load_templates_raw()

    # 1) try explicit templates
    templates: List[Dict[str, Any]] = []

    if isinstance(raw, list):
        templates = [t for t in raw if isinstance(t, dict)]
    elif isinstance(raw, dict):
        if isinstance(raw.get("templates"), list):
            templates = [t for t in raw["templates"] if isinstance(t, dict)]
        elif isinstance(raw.get("items"), list):
            templates = [t for t in raw["items"] if isinstance(t, dict)]
        elif isinstance(raw.get("events"), list):
            templates = [t for t in raw["events"] if isinstance(t, dict)]

    # If we have explicit templates, use them
    if templates:
        # normalize basic fields
        result: Dict[str, Dict[str, Any]] = {}
        for t in templates:
            code = t.get("code") or t.get("type")
            if not code:
                continue
            entry = result.get(code, {})
            entry.update(t)
            entry["code"] = code
            if not entry.get("label"):
                entry["label"] = code.replace("_", " ").title()
            result[code] = entry
        return sorted(result.values(), key=lambda x: x.get("code", ""))

    # 2) Fallback: infer minimal templates from real events
    events_raw = _load_events_raw()
    events: List[Dict[str, Any]] = []
    if isinstance(events_raw, list):
        events = [e for e in events_raw if isinstance(e, dict)]
    elif isinstance(events_raw, dict) and isinstance(events_raw.get("events"), list):
        events = [e for e in events_raw["events"] if isinstance(e, dict)]

    by_code: Dict[str, Dict[str, Any]] = {}
    for ev in events:
        code = ev.get("code") or ev.get("type")
        if not code:
            continue
        tpl = by_code.get(code, {})
        tpl["code"] = code
        tpl["label"] = tpl.get("label") or ev.get("label") or code.replace("_", " ").title()
        tpl["category"] = tpl.get("category") or ev.get("category")
        tpl["default_status"] = tpl.get("default_status") or ev.get("status") or "new"
        by_code[code] = tpl

    return sorted(by_code.values(), key=lambda x: x.get("code", ""))
    

@router.get("/")
def list_templates() -> List[Dict[str, Any]]:
    """
    Internal read-only view of control event templates.

    Always returns a flat list, even if underlying JSON uses other shapes.
    """
    return _normalize_templates()
