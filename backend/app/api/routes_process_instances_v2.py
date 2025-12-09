from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter

router = APIRouter(prefix="/api/internal", tags=["internal-processes-v2"])


def _load_raw_instances() -> List[Dict[str, Any]]:
    """
    Load process instances from JSON store created by
    dev_create_test_process_all_clients.

    Falls back to an empty list if the file is missing or invalid.
    """
    # project root: .../ERPv2_backend_connect/
    root = Path(__file__).resolve().parents[2]
    path = root / "process_instances_store.json"
    if not path.exists():
        return []

    try:
        raw = path.read_text(encoding="utf-8")
    except Exception:
        return []

    raw = raw.strip()
    if not raw:
        return []

    try:
        data = json.loads(raw)
    except Exception:
        return []

    # supported formats:
    # 1) plain list: [ {...}, {...} ]
    # 2) dict with "items" or "instances"
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        items = data.get("items") or data.get("instances") or []
        if isinstance(items, list):
            return items
    return []


@router.get("/process-instances-v2/")
async def list_process_instances_v2() -> Dict[str, Any]:
    """
    Lightweight read-only endpoint for frontend dashboards.

    Returns:
      {
        "instances": [
          { "id", "client_id", "profile_code", "period", "status" },
          ...
        ],
        "clients": [
          { "client_id": "ip_usn_dr" },
          ...
        ]
      }
    """
    raw_items = _load_raw_instances()

    instances: List[Dict[str, Any]] = []
    client_ids: List[str] = []

    for inst in raw_items:
        client_id = inst.get("client_id") or ""
        period = inst.get("period") or inst.get("month") or ""
        status = inst.get("computed_status") or inst.get("status") or "open"

        if client_id and client_id not in client_ids:
            client_ids.append(client_id)

        instances.append(
            {
                "id": inst.get("id"),
                "client_id": client_id,
                "profile_code": inst.get("profile_code") or "",
                "period": period,
                "status": status,
            }
        )

    clients = [{"client_id": cid} for cid in client_ids]

    return {"instances": instances, "clients": clients}
