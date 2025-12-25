from typing import Any, Dict, List, Optional
from app.core import process_instances_store as core_store

def _load_store() -> Dict[str, Any]:
    data = core_store.load_store()
    if isinstance(data, list):
        # legacy plain list: wrap
        return {"instances": data}
    if isinstance(data, dict):
        instances = data.get("instances")
        if isinstance(instances, list):
            return {"instances": instances}
    return {"instances": []}

def _save_store(store: Dict[str, Any]) -> None:
    instances = store.get("instances", [])
    core_store.save_store({"instances": instances})

def get_all_instances() -> List[Dict[str, Any]]:
    store = _load_store()
    return store.get("instances", [])

def list_instances_for_client(client_id: str) -> List[Dict[str, Any]]:
    instances = get_all_instances()
    return [i for i in instances if i.get("client_id") == client_id]

def find_instance_by_id(instance_id: str) -> Optional[Dict[str, Any]]:
    instances = get_all_instances()
    for i in instances:
        if i.get("id") == instance_id:
            return i
    return None

def upsert_instance_from_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Very simple upsert for dev/experimental use.
    Expects event to contain "client_id", "profile_code", "period".
    """
    client_id = event.get("client_id")
    profile_code = event.get("profile_code") or client_id
    period = event.get("period")

    store = _load_store()
    instances = store.get("instances", [])

    key = f"{client_id}::{profile_code}::{period}"
    target = None
    for inst in instances:
        if inst.get("key") == key:
            target = inst
            break

    if target is None:
        target = {
            "id": event.get("instance_id") or key,
            "key": key,
            "client_id": client_id,
            "profile_code": profile_code,
            "period": period,
            "status": "open",
            "source": "event",
            "events": [],
            "last_event_code": None,
            "steps": [],
        }
        instances.append(target)

    target["events"] = target.get("events", [])
    target["events"].append(event)
    target["last_event_code"] = event.get("code")
    target["status"] = event.get("status") or target.get("status", "open")

    store["instances"] = instances
    _save_store(store)
    return target