from typing import Any, Dict, Optional

from fastapi import APIRouter, Query

from app.services.process_overview_service import get_client_process_overview

router = APIRouter(
    prefix="/api/internal/process-overview",
    tags=["process-overview"],
)


@router.get("/client/{client_id}")
def client_process_overview(
    client_id: str,
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
) -> Dict[str, Any]:
    """
    Combined view for a client and period:

    - control events for the period
    - process instance attached to each event (created if missing)
    - list of instances for the client and period
    """
    payload = get_client_process_overview(
        client_id=client_id,
        year=year,
        month=month,
    )
    return payload
