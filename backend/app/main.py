from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Canonical root router (must exist in project)
from app.api import api_router
from app.api.routes_onboarding_intake import router as onboarding_intake_router


app = FastAPI(title="ERPv2 API")

origins = [
    "http://localhost",
    "http://localhost:5174",
    "http://127.0.0.1",
    "http://127.0.0.1:5174",
    "http://0.0.0.0",
    "http://0.0.0.0:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount existing API (tasks + internal + dev)
app.include_router(api_router, prefix="/api")

# Mount onboarding
app.include_router(onboarding_intake_router, prefix="/api")
