import json
import uuid
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
INST = BASE / "process_instances_store.json"
TEMPL = BASE / "process_step_templates_store.json"

def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}

def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

def make_steps():
    data = load_json(TEMPL)
    templates = data.get("step_templates", [])
    steps = []
    for t in templates:
        steps.append({
            "id": str(uuid.uuid4()),
            "template_id": t["id"],
            "title": t["name"],
            "status": t.get("default_status", "planned"),
            "created_at": datetime.utcnow().isoformat() + "Z"
        })
    return steps

def make_instance(client_code: str, profile_code: str, period: str):
    now = datetime.utcnow().isoformat() + "Z"
    return {
        "id": str(uuid.uuid4()),
        "key": f"{client_code}::{profile_code}::{period}",
        "client_id": client_code,
        "profile_code": profile_code,
        "period": period,
        "status": "open",
        "source": "dev_script",
        "events": [],
        "last_event_code": None,
        "steps": make_steps(),
        "created_at": now,
        "updated_at": now
    }

def main():
    period = "2025-12"
    clients = [
        ("ip_usn_dr", "ip_usn_dr"),
        ("ooo_osno_3_zp1025", "ooo_osno_3_zp1025"),
        ("ooo_usn_dr_tour", "ooo_usn_dr_tour"),
    ]

    store = {"instances": []}
    for client_code, profile_code in clients:
        store["instances"].append(make_instance(client_code, profile_code, period))

    save_json(INST, store)
    print("[OK] Dev instances created:", len(store["instances"]))

if __name__ == "__main__":
    main()