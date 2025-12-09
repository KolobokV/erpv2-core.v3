import json
import os
from dataclasses import dataclass
from typing import List, Dict, Any
from datetime import datetime
import argparse

PROCESS_INSTANCES_STORE_PATH = "process_instances_store.json"
STEP_TEMPLATES_STORE_PATH = "process_step_templates_store.json"


@dataclass
class ClientConfig:
    client_id: str
    profile_key: str
    label: str


DEMO_CLIENTS: List[ClientConfig] = [
    ClientConfig(client_id="ip_usn_dr", profile_key="ip_usn_dr", label="IP USN DR"),
    ClientConfig(client_id="ooo_osno_3_zp1025", profile_key="ooo_osno_3_zp1025", label="OOO OSNO 3 zp1025"),
    ClientConfig(client_id="ooo_usn_dr_tour", profile_key="ooo_usn_dr_tour", label="OOO USN DR + tourist tax"),
]

# Built-in default templates for all demo profiles
DEFAULT_STEP_TEMPLATES: List[Dict[str, Any]] = [
    # IP USN DR
    {
        "id": "tmpl_ip_usn_dr_bank_statement",
        "profile_key": "ip_usn_dr",
        "code": "bank_statement_request",
        "title": "Request bank statement",
        "description": "Request bank statement from bank for period",
        "order": 10,
    },
    {
        "id": "tmpl_ip_usn_dr_documents_request",
        "profile_key": "ip_usn_dr",
        "code": "documents_request",
        "title": "Request documents from client",
        "description": "Request primary documents from client after bank statement is received",
        "order": 20,
    },
    {
        "id": "tmpl_ip_usn_dr_check_income_expense",
        "profile_key": "ip_usn_dr",
        "code": "check_income_expense",
        "title": "Check income and expense",
        "description": "Check classification of income and expense for USN DR",
        "order": 30,
    },
    {
        "id": "tmpl_ip_usn_dr_tax_calc",
        "profile_key": "ip_usn_dr",
        "code": "calculate_tax",
        "title": "Calculate tax for period",
        "description": "Calculate USN DR tax and contributions for the period",
        "order": 40,
    },
    {
        "id": "tmpl_ip_usn_dr_send_result",
        "profile_key": "ip_usn_dr",
        "code": "send_results_to_client",
        "title": "Send results to client",
        "description": "Send tax and payment information to client",
        "order": 50,
    },

    # OOO OSNO 3 zp1025
    {
        "id": "tmpl_ooo_osno_payroll",
        "profile_key": "ooo_osno_3_zp1025",
        "code": "payroll_calc",
        "title": "Calculate payroll",
        "description": "Calculate payroll for employees for the period",
        "order": 10,
    },
    {
        "id": "tmpl_ooo_osno_ndfl",
        "profile_key": "ooo_osno_3_zp1025",
        "code": "ndfl_calc",
        "title": "Calculate NDFL",
        "description": "Calculate NDFL for all employees",
        "order": 20,
    },
    {
        "id": "tmpl_ooo_osno_contributions",
        "profile_key": "ooo_osno_3_zp1025",
        "code": "insurance_contributions",
        "title": "Calculate insurance contributions",
        "description": "Calculate insurance contributions for the period",
        "order": 30,
    },
    {
        "id": "tmpl_ooo_osno_vat",
        "profile_key": "ooo_osno_3_zp1025",
        "code": "vat_calc",
        "title": "Calculate VAT",
        "description": "Calculate VAT for the period",
        "order": 40,
    },

    # OOO USN DR + tourist tax
    {
        "id": "tmpl_ooo_usn_tour_payroll",
        "profile_key": "ooo_usn_dr_tour",
        "code": "payroll_calc",
        "title": "Calculate payroll",
        "description": "Calculate payroll for employees for the period",
        "order": 10,
    },
    {
        "id": "tmpl_ooo_usn_tour_ndfl",
        "profile_key": "ooo_usn_dr_tour",
        "code": "ndfl_calc",
        "title": "Calculate NDFL",
        "description": "Calculate NDFL for all employees",
        "order": 20,
    },
    {
        "id": "tmpl_ooo_usn_tour_contributions",
        "profile_key": "ooo_usn_dr_tour",
        "code": "insurance_contributions",
        "title": "Calculate insurance contributions",
        "description": "Calculate insurance contributions for the period",
        "order": 30,
    },
    {
        "id": "tmpl_ooo_usn_tour_tourist_tax",
        "profile_key": "ooo_usn_dr_tour",
        "code": "tourist_tax_calc",
        "title": "Calculate tourist tax",
        "description": "Calculate tourist tax for the period",
        "order": 40,
    },
]


def load_json(path: str, default):
    if not os.path.exists(path):
        print(f"[WARN] JSON store not found: {path}, using default")
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except UnicodeDecodeError as exc:
        message = str(exc)
        if "UTF-8 BOM" in message or "BOM" in message:
            print(f"[WARN] UTF-8 BOM detected in {path}, retrying with utf-8-sig")
            try:
                with open(path, "r", encoding="utf-8-sig") as f:
                    return json.load(f)
            except Exception as exc2:
                print(f"[WARN] Failed to load JSON from {path} with utf-8-sig: {exc2}, using default")
                return default
        print(f"[WARN] Failed to load JSON from {path}: {exc}, using default")
        return default
    except Exception as exc:
        print(f"[WARN] Failed to load JSON from {path}: {exc}, using default")
        return default


def save_json(path: str, data) -> None:
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, path)


def load_step_templates(path: str) -> List[Dict[str, Any]]:
    print(f"[INFO] Loading step templates from: {path}")
    raw = load_json(path, default=None)

    templates: List[Dict[str, Any]] = []

    if isinstance(raw, list):
        templates = [t for t in raw if isinstance(t, dict)]
    elif isinstance(raw, dict):
        if "templates" in raw and isinstance(raw["templates"], list):
            templates = [t for t in raw["templates"] if isinstance(t, dict)]
        elif "items" in raw and isinstance(raw["items"], list):
            templates = [t for t in raw["items"] if isinstance(t, dict)]
        else:
            templates = [raw]

    if templates:
        non_generic_keys = {
            t.get("profile_key")
            for t in templates
            if isinstance(t, dict) and t.get("profile_key") not in (None, "", "generic")
        }
        print(f"[INFO] Loaded {len(templates)} templates from store, distinct non-generic profile_keys={len(non_generic_keys)}")
        return templates

    print(f"[WARN] No valid templates found in store, using built-in defaults ({len(DEFAULT_STEP_TEMPLATES)})")
    return list(DEFAULT_STEP_TEMPLATES)


def select_templates_for_profile(all_templates: List[Dict[str, Any]], profile_key: str) -> List[Dict[str, Any]]:
    specific = [t for t in all_templates if t.get("profile_key") == profile_key]
    generic = [t for t in all_templates if t.get("profile_key") in (None, "", "generic")]

    if specific:
        print(f"[INFO] Using {len(specific)} specific templates for profile_key={profile_key}")
        return sorted(specific, key=lambda t: t.get("order", 0))

    if generic:
        print(f"[WARN] No specific templates for profile_key={profile_key}, using {len(generic)} generic templates")
        return sorted(generic, key=lambda t: t.get("order", 0))

    print(f"[WARN] No templates at all for profile_key={profile_key}, returning empty list")
    return []


def make_step_from_template(template: Dict[str, Any], client_id: str, period: str) -> Dict[str, Any]:
    return {
        "id": f"{template.get('id', 'step')}::{client_id}::{period}",
        "code": template.get("code", "step"),
        "title": template.get("title", "Step"),
        "description": template.get("description", ""),
        "order": template.get("order", 0),
        "status": "pending",
        "period": period,
        "client_id": client_id,
    }


def compute_target_periods(year: int, month: int, months_back: int) -> List[str]:
    periods: List[str] = []
    current = datetime(year=year, month=month, day=1)
    for i in range(months_back):
        y = current.year
        m = current.month - i
        while m <= 0:
            y -= 1
            m += 12
        periods.append(f"{y:04d}-{m:02d}")
    periods = sorted(set(periods))
    return periods


def upsert_instance(
    store: List[Dict[str, Any]],
    client: ClientConfig,
    period: str,
    templates_for_profile: List[Dict[str, Any]],
) -> None:
    key = f"{client.client_id}::{client.profile_key}::{period}"
    existing = next((inst for inst in store if inst.get("key") == key), None)

    steps = [make_step_from_template(t, client.client_id, period) for t in templates_for_profile]

    instance = {
        "key": key,
        "client_id": client.client_id,
        "profile_key": client.profile_key,
        "label": client.label,
        "period": period,
        "steps": steps,
        "status": "completed" if not steps else "in_progress",
    }

    if existing:
        idx = store.index(existing)
        store[idx] = instance
    else:
        store.append(instance)

    print(
        f"[INFO] Upserting dev instance for client={client.client_id}, "
        f"profile={client.profile_key}, label={client.label}, period={period}\n"
        f"       -> key={key}, steps={len(steps)}, status={instance['status']}"
    )


def main():
    parser = argparse.ArgumentParser(description="Dev helper: create or update process instances for demo clients.")
    parser.add_argument("--client", type=str, default=None, help="Limit to single client_id")
    parser.add_argument("--year", type=int, default=None, help="Target year (default: current year)")
    parser.add_argument("--month", type=int, default=None, help="Target month (default: current month)")
    parser.add_argument("--months-back", type=int, default=4, help="How many months back to include (default: 4)")

    args, _unknown = parser.parse_known_args()

    today = datetime.today()
    year = args.year or today.year
    month = args.month or today.month
    months_back = args.months_back

    print(f"[INFO] Using store: {PROCESS_INSTANCES_STORE_PATH}")
    instances_raw = load_json(PROCESS_INSTANCES_STORE_PATH, default=[])
    if not isinstance(instances_raw, list):
        print("[WARN] process_instances_store.json is not a list, resetting to empty list")
        instances: List[Dict[str, Any]] = []
    else:
        instances = instances_raw
    print(f"[INFO] Loaded {len(instances)} instances from store")

    all_templates = load_step_templates(STEP_TEMPLATES_STORE_PATH)

    periods = compute_target_periods(year, month, months_back)
    print(f"[INFO] Target periods: {periods}\n")

    if args.client:
        target_clients = [c for c in DEMO_CLIENTS if c.client_id == args.client]
        if not target_clients:
            print(f"[WARN] Client with client_id={args.client} not found in DEMO_CLIENTS, nothing to do")
            return
    else:
        target_clients = DEMO_CLIENTS

    for client in target_clients:
        print(f"[INFO] Processing client={client.client_id}, profile={client.profile_key}")
        templates_for_profile = select_templates_for_profile(all_templates, client.profile_key)
        for period in periods:
            upsert_instance(instances, client, period, templates_for_profile)
        print()

    save_json(PROCESS_INSTANCES_STORE_PATH, instances)
    print("[INFO] Dev process instances upsert completed.")


if __name__ == "__main__":
    main()
