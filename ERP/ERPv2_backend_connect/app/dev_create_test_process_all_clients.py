import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple


DEV_CLIENTS = [
    {
        "client_id": "ip_usn_dr",
        "profile_code": "ip_usn_dr",
        "label": "IP USN DR",
    },
    {
        "client_id": "ooo_osno_3_zp1025",
        "profile_code": "ooo_osno_3_zp1025",
        "label": "OOO OSNO 3 ZP 10/25",
    },
    {
        "client_id": "ooo_usn_dr_tour_zp520",
        "profile_code": "ooo_usn_dr_tour_zp520",
        "label": "OOO USN DR TOUR ZP 5/20",
    },
]


def get_now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def get_current_period() -> str:
    now = datetime.utcnow()
    return f"{now.year:04d}-{now.month:02d}"


def load_instances_store(path: Path) -> Tuple[List[Dict[str, Any]], bool]:
    if not path.exists():
        return [], False

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data, False

    if isinstance(data, dict) and isinstance(data.get("items"), list):
        return list(data["items"]), True

    raise ValueError("Unexpected process_instances_store format")


def save_instances_store(path: Path, items: List[Dict[str, Any]], wrapped: bool) -> None:
    if wrapped:
        out: Any = {"items": items}
    else:
        out = items

    tmp_path = path.with_suffix(".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    tmp_path.replace(path)


def load_step_templates(path: Path) -> Dict[str, Any]:
    if not path.exists():
        print(f"[WARN] Step templates file not found: {path}")
        return {}

    try:
        # utf-8-sig to handle BOM from PowerShell-created files
        with path.open("r", encoding="utf-8-sig") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
        print("[WARN] Step templates file has unexpected structure (not dict), ignoring")
        return {}
    except Exception as exc:
        print(f"[WARN] Failed to load step templates: {exc}")
        return {}


def compute_status_from_steps(steps: List[Dict[str, Any]]) -> str:
    if not steps:
        return "open"

    has_error = any((step.get("status") or "").lower() == "error" for step in steps)
    if has_error:
        return "error"

    normalized = [(step.get("status") or "").lower() for step in steps]
    if all(s == "completed" for s in normalized if s):
        return "completed"

    has_active = any(s in ("open", "waiting", "pending") for s in normalized)
    if has_active:
        return "waiting"

    return "open"


def build_default_steps_fallback(label: str) -> List[Dict[str, Any]]:
    now_iso = get_now_iso()

    templates = [
        {
            "title": f"{label}: Request bank statements",
            "status": "open",
        },
        {
            "title": f"{label}: Request primary documents",
            "status": "waiting",
        },
        {
            "title": f"{label}: Prepare tax and reports",
            "status": "open",
        },
    ]

    steps: List[Dict[str, Any]] = []
    for tmpl in templates:
        steps.append(
            {
                "id": str(uuid.uuid4()),
                "title": tmpl["title"],
                "status": tmpl["status"],
                "created_at": now_iso,
                "completed_at": None,
            }
        )
    return steps


def build_default_steps_from_templates(
    profile_code: str,
    label: str,
    templates_index: Dict[str, Any],
) -> List[Dict[str, Any]]:
    now_iso = get_now_iso()

    profile_cfg = templates_index.get(profile_code)
    if not isinstance(profile_cfg, dict):
        return build_default_steps_fallback(label)

    raw_steps = profile_cfg.get("steps")
    if not isinstance(raw_steps, list) or not raw_steps:
        return build_default_steps_fallback(label)

    steps: List[Dict[str, Any]] = []
    for item in raw_steps:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or f"{label}: Step"
        status = (item.get("status") or "open").lower()
        steps.append(
            {
                "id": str(uuid.uuid4()),
                "title": str(title),
                "status": status,
                "created_at": now_iso,
                "completed_at": None,
            }
        )

    if not steps:
        return build_default_steps_fallback(label)

    return steps


def ensure_default_steps(
    instance: Dict[str, Any],
    profile_code: str,
    label: str,
    templates_index: Dict[str, Any],
) -> None:
    # Dev-mode: always override steps from templates for demo clients
    new_steps = build_default_steps_from_templates(profile_code, label, templates_index)
    instance["steps"] = new_steps

    status = compute_status_from_steps(new_steps)
    instance["status"] = status
    instance["computed_status"] = status


def upsert_dev_instance(
    items: List[Dict[str, Any]],
    client_id: str,
    profile_code: str,
    label: str,
    period: str,
    templates_index: Dict[str, Any],
) -> Dict[str, Any]:
    key = f"{client_id}::{profile_code}::{period}"

    for inst in items:
        if inst.get("key") == key:
            ensure_default_steps(inst, profile_code, label, templates_index)
            inst["updated_at"] = get_now_iso()
            return inst

    now_iso = get_now_iso()
    new_inst: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "key": key,
        "client_id": client_id,
        "profile_code": profile_code,
        "period": period,
        "status": "open",
        "computed_status": "open",
        "source": "dev_create_test_process_all_clients",
        "events": [],
        "last_event_code": "dev_test_process_run",
        "steps": [],
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    ensure_default_steps(new_inst, profile_code, label, templates_index)
    items.append(new_inst)
    return new_inst


def main() -> None:
    base_dir = Path(__file__).resolve().parent.parent
    store_path = base_dir / "process_instances_store.json"
    templates_path = base_dir / "process_step_templates_store.json"

    print(f"[INFO] Using store: {store_path}")
    items, wrapped = load_instances_store(store_path)
    print(f"[INFO] Loaded {len(items)} instances from store")

    print(f"[INFO] Loading step templates from: {templates_path}")
    templates_index = load_step_templates(templates_path)

    period = get_current_period()
    print(f"[INFO] Target period: {period}")

    for cfg in DEV_CLIENTS:
        client_id = cfg["client_id"]
        profile_code = cfg["profile_code"]
        label = cfg["label"]

        print(
            f"[INFO] Upserting dev instance for client={client_id}, profile={profile_code}, label={label}"
        )
        inst = upsert_dev_instance(
            items=items,
            client_id=client_id,
            profile_code=profile_code,
            label=label,
            period=period,
            templates_index=templates_index,
        )
        steps = inst.get("steps") or []
        print(
            f"       -> instance_id={inst.get('id')}, key={inst.get('key')}, steps={len(steps)}, status={inst.get('status')}/{inst.get('computed_status')}"
        )

    save_instances_store(store_path, items, wrapped)
    print("[OK] Dev process instances for all demo clients updated")


if __name__ == "__main__":
    main()
