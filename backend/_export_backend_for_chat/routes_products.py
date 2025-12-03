
from fastapi import APIRouter, HTTPException
from app.services.dolibarr import DolibarrService

router = APIRouter()

@router.get("/products")
def get_products():
    try:
        items = DolibarrService.list_products()
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
