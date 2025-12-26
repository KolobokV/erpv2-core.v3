from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="ERPv2")

    # CORS for local dev (frontend on Vite)
    allow_origins = [
        "http://localhost:5174",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Main API router (/api/*)
    try:
        from app.api.api_router import api_router
        app.include_router(api_router)
    except Exception as e:
        # keep boot alive
        print(f"[WARN] api_router not loaded: {e}")

    # Internal dev router (/api/internal/*)
    try:
        from app.internal_router import internal_router
        app.include_router(internal_router)
    except Exception as e:
        # keep boot alive
        print(f"[WARN] internal_router not loaded: {e}")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
