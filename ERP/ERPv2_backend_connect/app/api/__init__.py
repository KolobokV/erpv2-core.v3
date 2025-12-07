from fastapi import APIRouter
import importlib
import pkgutil
from types import ModuleType
from typing import Any


api_router = APIRouter()


def _include_router_from_module(module: ModuleType) -> None:
    router = getattr(module, "router", None)
    if router is None:
        return
    if not isinstance(router, APIRouter):
        return
    api_router.include_router(router)


def _autoload_routes() -> None:
    """
    Autoload all modules under app.api whose name starts with routes_*
    and include their `router` into api_router.
    """
    # local import to keep package resolution simple
    from app import api as pkg  # type: ignore

    for module_info in pkgutil.iter_modules(pkg.__path__):
        name = module_info.name
        if not name.startswith("routes_"):
            continue
        full_name = f"{pkg.__name__}.{name}"
        try:
            module = importlib.import_module(full_name)
        except Exception:
            # do not break app startup because of broken optional module
            continue
        _include_router_from_module(module)


# run autoload on import
_autoload_routes()

# legacy alias, in case main.py imports `from app.api import router`
router = api_router

__all__ = ["api_router", "router"]
