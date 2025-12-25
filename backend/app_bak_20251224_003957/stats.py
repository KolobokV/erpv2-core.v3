from fastapi import APIRouter
from pydantic import BaseModel
import os
import httpx

router = APIRouter()


class Stats(BaseModel):
    total_clients: int
    total_products: int
    total_invoices: int
    total_tasks_today: int


async def _safe_count(url: str) -> int:
    """
    Helper: call Dolibarr endpoint and return number of items.
    Any error => 0, no exceptions are propagated.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list):
            return len(data)
        if isinstance(data, dict):
            items = data.get("items")
            if isinstance(items, list):
                return len(items)
    except Exception:
        return 0
    return 0


async def _collect_stats() -> Stats:
    base = os.getenv("DOLI_API_URL") or "http://host.docker.internal:8282/api/index.php"
    key = os.getenv("DOLI_API_KEY")

    if not key:
        return Stats(
            total_clients=0,
            total_products=0,
            total_invoices=0,
            total_tasks_today=0,
        )

    base = base.rstrip("/")
    key_param = f"?DOLAPIKEY={key}&limit=1000"

    clients_url = f"{base}/thirdparties{key_param}"
    products_url = f"{base}/products{key_param}"
    invoices_url = f"{base}/invoices{key_param}"
    # Simple approximation for tasks count: Dolibarr agenda events.
    tasks_url = f"{base}/agendaevents{key_param}"

    total_clients = await _safe_count(clients_url)
    total_products = await _safe_count(products_url)
    total_invoices = await _safe_count(invoices_url)
    total_tasks_today = await _safe_count(tasks_url)

    return Stats(
        total_clients=total_clients,
        total_products=total_products,
        total_invoices=total_invoices,
        total_tasks_today=total_tasks_today,
    )


@router.get("/stats", response_model=Stats)
async def get_stats_root() -> Stats:
    return await _collect_stats()


@router.get("/api/stats", response_model=Stats)
async def get_stats_api() -> Stats:
    # Same data, different URL for convenience (frontend can use /api/stats).
    return await _collect_stats()