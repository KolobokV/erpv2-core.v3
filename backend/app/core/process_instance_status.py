from __future__ import annotations

from typing import Any, Dict, List


InstanceDict = Dict[str, Any]


def compute_instance_status(instance: InstanceDict) -> str:
    """
    Compute a derived status for a process instance based on its steps.

    Rules (can be changed later without touching storage format):
    - If any step has status "error" -> "error"
    - Else if there are steps:
        - If all steps are "completed" -> "completed"
        - If there is at least one "pending" step with "wait" in the title -> "waiting"
        - Otherwise -> "open"
    - If there are no steps:
        - Prefer instance["status"] if present
        - Fallback to "open"
    """
    if not instance:
        return "unknown"

    steps: List[Dict[str, Any]] = instance.get("steps") or []

    # Error has the highest priority.
    for step in steps:
        if (step.get("status") or "").lower() == "error":
            return "error"

    if steps:
        # If all steps are completed -> "completed".
        if all((step.get("status") or "").lower() == "completed" for step in steps):
            return "completed"

        # If there is a pending "wait"-type step -> "waiting".
        for step in steps:
            status = (step.get("status") or "").lower()
            title = (step.get("title") or "").lower()
            if status == "pending" and "wait" in title:
                return "waiting"

        # Default status when there are steps but no special conditions.
        return "open"

    # No steps: use stored status if it exists, otherwise treat as open.
    stored_status = (instance.get("status") or "").strip()
    if stored_status:
        return stored_status

    return "open"


def annotate_instance_with_computed_status(instance: InstanceDict) -> InstanceDict:
    """
    Return a shallow copy of the instance with a "computed_status" field added.
    The original dict is not modified.
    """
    if not instance:
        return instance

    derived_status = compute_instance_status(instance)
    annotated = dict(instance)
    annotated["computed_status"] = derived_status
    return annotated


def annotate_instances_with_computed_status(
    instances: List[InstanceDict],
) -> List[InstanceDict]:
    """
    Apply annotate_instance_with_computed_status to a list of instances.
    """
    return [annotate_instance_with_computed_status(i) for i in instances]
