
from fastapi import APIRouter, HTTPException
from app.services.dolibarr import DolibarrService

router = APIRouter()

@router.get("/clients")
def get_clients():
    try:
        items = DolibarrService.list_clients()
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
