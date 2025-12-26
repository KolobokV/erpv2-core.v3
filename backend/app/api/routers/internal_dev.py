from fastapi import APIRouter
import json
from pathlib import Path

router = APIRouter()
BASE_DIR = Path(__file__).resolve().parents[3]

def load_json_safe(name: str, default):
    try:
        path = BASE_DIR / name
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

@router.get("/process-instances-v2/")
def process_instances():
    return load_json_safe("process_instances_store.json", [])

@router.get("/control-events-store-v2/")
def control_events_store():
    return load_json_safe("control_events_store.json", [])

@router.get("/client-profiles")
def client_profiles():
    return load_json_safe("client_profiles_store.json", [])

@router.get("/process-chains/dev/")
def process_chains_dev():
    return load_json_safe("process_chains_store.json", [])