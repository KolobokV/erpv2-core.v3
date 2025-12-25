from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

try:
    # optional import to push tasks from scheduler
    from .routes_tasks import TASKS
except Exception:
    TASKS: List[Dict[str, Any]] = []  # fallback, local only

router = APIRouter(prefix="/api/internal", tags=["internal-processes"])


CLIENT_PROFILES: List[Dict[str, Any]] = [
    {
        "id": "ip_usn_dr",
        "name": "Demo IP USN DR",
        "tax_regime": "usn_dr",
        "employees_count": 0,
        "salary_dates": [],
        "has_vat": False,
        "has_tourist_fee": False,
        "auto_generate_bank_tasks": True,
    },
    {
        "id": "ooo_osno_3_zp1025",
        "name": "Demo OOO OSNO 3 employees",
        "tax_regime": "osno_vat",
        "employees_count": 3,
        "salary_dates": [10, 25],
        "has_vat": True,
        "has_tourist_fee": False,
        "auto_generate_bank_tasks": True,
    },
    {
        "id": "ooo_usn_dr_tour_zp520",
        "name": "Demo OOO USN DR + tour fee",
        "tax_regime": "usn_dr_tour",
        "employees_count": 2,
        "salary_dates": [5, 20],
        "has_vat": False,
        "has_tourist_fee": True,
        "auto_generate_bank_tasks": True,
    },
]


PROCESS_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "id": "proc_bank_monthly",
        "name": "Monthly bank statement and documents",
        "scope": None,
        "description": "Request bank statement, collect documents, prepare summary.",
    },
    {
        "id": "proc_salary_and_ndfl",
        "name": "Salary and NDFL",
        "scope": "osno_vat",
        "description": "Salary accrual and NDFL payment.",
    },
    {
        "id": "proc_tourist_fee",
        "name": "Tourist fee monthly",
        "scope": "usn_dr_tour",
        "description": "Monthly tourist fee reporting and payment.",
    },
]


PROCESS_INSTANCES: List[Dict[str, Any]] = []

INSTANCE_TASKS: Dict[str, List[Dict[str, Any]]] = {}


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _ensure_demo_instances() -> None:
    if PROCESS_INSTANCES:
        return
    today = date.today()
    month = _month_key(today)

    for client in CLIENT_PROFILES:
        for defin in PROCESS_DEFINITIONS:
            if defin["scope"] and defin["scope"] != client["tax_regime"]:
                continue
            inst_id = f"inst_{client['id']}_{defin['id']}_{month}"
            PROCESS_INSTANCES.append(
                {
                    "id": inst_id,
                    "definition_id": defin["id"],
                    "definition_name": defin["name"],
                    "client_id": client["id"],
                    "month": month,
                    "status": "ready",
                    "last_run_result": "demo instance",
                    "created_at": today.isoformat(),
                }
            )


@router.get("/client-profiles")
async def list_client_profiles() -> Dict[str, Any]:
    return {"items": CLIENT_PROFILES}


@router.get("/process-definitions")
async def list_process_definitions() -> Dict[str, Any]:
    return {"items": PROCESS_DEFINITIONS}


@router.get("/process-instances")
async def list_process_instances() -> Dict[str, Any]:
    _ensure_demo_instances()
    return {"items": PROCESS_INSTANCES}


@router.get("/process-instances/{instance_id}/tasks")
async def get_tasks_for_instance(instance_id: str) -> Dict[str, Any]:
    tasks = INSTANCE_TASKS.get(instance_id, [])
    return {"items": tasks}


@router.post("/process-instances/{instance_id}/generate-tasks")
async def generate_tasks_for_instance(instance_id: str) -> Dict[str, Any]:
    _ensure_demo_instances()
    instance = next(
        (i for i in PROCESS_INSTANCES if str(i.get("id")) == instance_id), None
    )
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    today = date.today()
    task_id = f"task_{instance_id}_01"
    task = {
        "id": task_id,
        "title": f"Run process {instance.get('definition_id')} for {instance.get('client_id')}",
        "description": f"Auto-generated task for instance {instance_id}.",
        "status": "planned",
        "client_id": instance.get("client_id"),
        "due_date": today.isoformat(),
        "process_instance_id": instance_id,
    }

    tasks_for_inst = INSTANCE_TASKS.setdefault(instance_id, [])
    tasks_for_inst.append(task)

    # also push to global TASKS if available
    TASKS.append(task)

    instance["status"] = "tasks_generated"
    instance["last_run_result"] = "tasks generated"
    return {
        "status": "ok",
        "instance_id": instance_id,
        "tasks_generated": 1,
        "tasks": [task],
    }


@router.post("/scheduler/run-monthly")
async def run_monthly_scheduler(request: Request) -> Dict[str, Any]:
    """
    Very simple demo scheduler.
    Creates process instances for current month for all clients and definitions.
    Optionally generates tasks for each new instance.
    """
    body = await request.json()
    generate_tasks_flag = bool(body.get("generate_tasks", False))

    today = date.today()
    month = _month_key(today)

    definitions_considered = 0
    clients_considered = 0
    instances_created = 0
    instances_skipped = 0
    tasks_generated = 0

    for client in CLIENT_PROFILES:
        clients_considered += 1
        for defin in PROCESS_DEFINITIONS:
            if defin["scope"] and defin["scope"] != client["tax_regime"]:
                continue

            definitions_considered += 1
            inst_id = f"inst_{client['id']}_{defin['id']}_{month}"

            existing = next(
                (i for i in PROCESS_INSTANCES if str(i.get("id")) == inst_id),
                None,
            )
            if existing:
                instances_skipped += 1
                continue

            instance = {
                "id": inst_id,
                "definition_id": defin["id"],
                "definition_name": defin["name"],
                "client_id": client["id"],
                "month": month,
                "status": "ready",
                "last_run_result": "created by scheduler",
                "created_at": today.isoformat(),
            }
            PROCESS_INSTANCES.append(instance)
            instances_created += 1

            if generate_tasks_flag:
                task_id = f"task_{inst_id}_01"
                task = {
                    "id": task_id,
                    "title": f"Run process {defin['id']} for {client['id']}",
                    "description": f"Auto-generated by monthly scheduler for {month}.",
                    "status": "planned",
                    "client_id": client["id"],
                    "due_date": today.isoformat(),
                    "process_instance_id": inst_id,
                }
                tasks_for_inst = INSTANCE_TASKS.setdefault(inst_id, [])
                tasks_for_inst.append(task)
                TASKS.append(task)
                tasks_generated += 1

    result = {
        "status": "ok",
        "target_period": month,
        "definitions_considered": definitions_considered,
        "clients_considered": clients_considered,
        "instances_created": instances_created,
        "instances_skipped_existing": instances_skipped,
        "generate_tasks": generate_tasks_flag,
        "tasks_generated": tasks_generated,
    }
    return result
