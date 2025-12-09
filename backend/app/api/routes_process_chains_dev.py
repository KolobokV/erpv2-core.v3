from typing import Any, Dict, List

from fastapi import APIRouter, Query

from app.services.chain_executor import get_dev_runs, run_dev_chain_for_client

router = APIRouter(
    prefix="/api/internal/process-chains/dev",
    tags=["internal-process-chains-dev"],
)


@router.get("/", response_model=List[Dict[str, Any]])
def list_dev_runs() -> List[Dict[str, Any]]:
    """
    Return all dev chain runs from process_chains_store.json.
    """
    return get_dev_runs()


@router.post("/run-for-client/{client_id}")
def run_for_client_post(
    client_id: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    """
    Trigger dev chain executor for given client and period.

    Internally it calls python -m app.dev_create_test_process_all_clients
    and logs run metadata in process_chains_store.json.
    """
    return run_dev_chain_for_client(client_id=client_id, year=year, month=month)


@router.get("/run-for-client/{client_id}")
def run_for_client_get(
    client_id: str,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> Dict[str, Any]:
    """
    GET variant for convenience (dev usage).
    """
    return run_dev_chain_for_client(client_id=client_id, year=year, month=month)
