from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.core import process_instances_store
from app.core.process_auto_steps import get_auto_steps_for_event
from app.core.process_instance_status import (
    annotate_instance_with_computed_status,
    annotate_instances_with_computed_status,
)


InstanceDict = Dict[str, Any]


def _ensure_auto_steps_for_instance(instance: InstanceDict, event: Dict[str, Any]) -> InstanceDict:
    """
    Attach auto-generated steps to a freshly created instance.

    Rules:
    - Auto steps are created ONLY if the instance currently has no steps.
    - Mapping is driven by event["event_code"] (with a small fallback to "code").
    - If there is no mapping for this event code, the instance is returned as is.
    """
    steps = instance.get("steps") or []
    if steps:
        # There are already steps, do not overwrite or duplicate them.
        return instance

    event_code: Optional[str] = event.get("event_code") or event.get("code")
    step_titles: List[str] = get_auto_steps_for_event(event_code or "")

    if not step_titles:
        return instance

    updated_instance = instance
    for title in step_titles:
        # process_instances_store.add_step must return the updated instance.
        updated_instance = process_instances_store.add_step(updated_instance["id"], title)

    return updated_instance


def find_or_create_process_instance_from_event(event: Dict[str, Any]) -> InstanceDict:
    """
    Find or create a process instance based on control event payload.

    The low-level lookup / upsert logic lives in process_instances_store.
    This service adds a thin layer on top:
    - upsert instance based on client_id + profile_code + period
    - attach auto-steps if this is a fresh instance with no steps yet
    - annotate instance with computed_status derived from its steps
    """
    instance = process_instances_store.upsert_instance_from_event(event)
    instance = _ensure_auto_steps_for_instance(instance, event)
    instance = annotate_instance_with_computed_status(instance)
    return instance


def list_process_instances() -> List[InstanceDict]:
    """
    Return all process instances from the JSON store, annotated with computed_status.
    """
    instances = process_instances_store.get_all_instances()
    return annotate_instances_with_computed_status(instances)


def list_process_instances_for_client(client_id: str, period: Optional[str] = None) -> List[InstanceDict]:
    """
    Return process instances for a specific client and optional period (YYYY-MM),
    annotated with computed_status.
    """
    instances = process_instances_store.list_instances_for_client(client_id=client_id, period=period)
    return annotate_instances_with_computed_status(instances)


def get_process_instance(instance_id: str) -> Optional[InstanceDict]:
    """
    Return a single process instance by its id, annotated with computed_status,
    or None if not found.
    """
    instance = process_instances_store.find_instance_by_id(instance_id)
    if not instance:
        return None
    return annotate_instance_with_computed_status(instance)


def add_step(instance_id: str, title: str) -> InstanceDict:
    """
    Add a new step with 'pending' status to the given instance and return it
    annotated with computed_status.
    """
    instance = process_instances_store.add_step(instance_id, title)
    return annotate_instance_with_computed_status(instance)


def complete_step(instance_id: str, step_id: str) -> InstanceDict:
    """
    Mark a specific step as completed, update instance status if needed in the store,
    and return it annotated with computed_status.
    """
    instance = process_instances_store.complete_step(instance_id, step_id)
    return annotate_instance_with_computed_status(instance)
