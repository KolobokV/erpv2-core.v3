from typing import Any, Dict, List

from app.core.process_instances_store import (
    find_instance_by_id,
    get_all_instances,
    list_instances_for_client,
    upsert_instance_from_event,
    add_step as store_add_step,
    complete_step as store_complete_step,
)


def find_or_create_process_instance_from_event(event: Dict[str, Any]) -> Dict[str, Any]:
    return upsert_instance_from_event(event)


def list_process_instances() -> List[Dict[str, Any]]:
    return get_all_instances()


def list_process_instances_for_client(client_id: str, period: str | None = None) -> List[Dict[str, Any]]:
    return list_instances_for_client(client_id=client_id, period=period)


def get_process_instance(instance_id: str) -> Dict[str, Any]:
    inst = find_instance_by_id(instance_id)
    if inst is None:
        raise ValueError(f"Process instance not found: {instance_id}")
    return inst


# --------------------------
# E2.5 — STEPS API
# --------------------------

def add_step(instance_id: str, title: str) -> Dict[str, Any]:
    return store_add_step(instance_id, title)


def complete_step(instance_id: str, step_id: str) -> Dict[str, Any]:
    return store_complete_step(instance_id, step_id)
