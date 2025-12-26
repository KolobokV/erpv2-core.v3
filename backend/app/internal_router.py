from fastapi import APIRouter

internal_router = APIRouter(prefix="/api/internal")

try:
    from app.internal_dev_api import router as dev_router
    internal_router.include_router(dev_router)
except Exception as e:
    print(f"[WARN] internal_dev_api not loaded: {e}")
