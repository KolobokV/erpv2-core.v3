
from fastapi import APIRouter, HTTPException
from app.services.dolibarr import DolibarrService

router = APIRouter()

@router.get("/invoices")
def get_invoices():
    try:
        items = DolibarrService.list_invoices()
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
