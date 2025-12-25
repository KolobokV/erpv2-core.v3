import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/internal", tags=["internal-processes"])

def _get_store_path() -> Path:
    # base_dir = ERPv2_backend_connect
    return Path(__file__).resolve().parents[2] / "process_instances_store.json"

def _load_instances():
    path = _get_store_path()
    if not path.exists():
        return []

    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception:
        return []

    if isinstance(data, dict):
        inst = data.get("instances", [])
    elif isinstance(data, list):
        inst = data
    else:
        inst = []

    if not isinstance(inst, list):
        return []

    return inst

@router.get("/process-instances-v2/")
def get_instances_v2():
    """
    API used by InternalProcessesPage.tsx and ProcessCoveragePage.tsx.

    Always returns structure:
    {
      "instances": [...],
      "total": N
    }
    without raising errors, even if store is broken.
    """
    instances = _load_instances()
    return {"instances": instances, "total": len(instances)}