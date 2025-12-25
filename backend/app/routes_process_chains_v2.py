from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from app.core.events import EventTypes, get_event_system
from app.core.store_json import load_json_store
from app.core.scheduler_reglament import REGLEMENT_CHAINS

CHAIN_RUNS_STORE = "chain_runs_store.json"

router = APIRouter(
    prefix="/api/internal/chains",
    tags=["internal.chains"]
)


# -----------------------------
# GET /runs
# -----------------------------
@router.get("/runs")
def api_get_chain_runs() -> Dict[str, Any]:
    data = load_json_store(CHAIN_RUNS_STORE, default={"runs": []})
    if isinstance(data, dict) and isinstance(data.get("runs"), list):
        return data
    return {"runs": []}


# -----------------------------
# POST /run
# Trigger a single chain by event
# -----------------------------
@router.post("/run")
async def api_run_chain(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expected payload:
    {
        "chain_id": "...",
        "client_id": "...",
        "period": "YYYY-MM",
        "mode": "dev" | "reglament",
        "trigger": "api"
    }
    """
    chain_id = payload.get("chain_id")
    client_id = payload.get("client_id")
    period = payload.get("period")

    if not chain_id or not client_id or not period:
        raise HTTPException(status_code=400, detail="Invalid payload")

    es = get_event_system()
    await es.publish(EventTypes.CHAIN_TRIGGERED, payload)

    return {"status": "accepted", "payload": payload}


# -----------------------------
# POST /run/all
# Fire all configured reglement chains for given period
# -----------------------------
@router.post("/run/all")
async def api_run_all_chains(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expected payload:
    {
        "period": "YYYY-MM"
    }

    It will trigger ALL reglement chains for that period.
    """
    period = payload.get("period")
    if not period:
        raise HTTPException(status_code=400, detail="Missing period")

    es = get_event_system()

    dispatched: List[Dict[str, Any]] = []

    for cfg in REGLEMENT_CHAINS:
        p = {
            "chain_id": cfg["chain_id"],
            "client_id": cfg["client_id"],
            "period": period,
            "mode": "reglament",
            "trigger": "api",
        }
        await es.publish(EventTypes.CHAIN_TRIGGERED, p)
        dispatched.append(p)

    return {
        "status": "accepted",
        "count": len(dispatched),
        "chains": dispatched
    }
