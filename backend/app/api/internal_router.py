from fastapi import APIRouter
from app.api.routers.internal_dev import router as internal_dev_router

internal_router = APIRouter(prefix="/api/internal")
internal_router.include_router(internal_dev_router)