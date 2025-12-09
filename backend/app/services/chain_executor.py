from __future__ import annotations

import subprocess
import sys
import uuid
from datetime import datetime
from typing import Any, Dict, List, Tuple

from app.core.store_json import load_json_store, save_json_store

CHAIN_STORE_NAME = "process_chains_store.json"
INSTANCES_STORE_NAME = "process_instances_store.json"


def _load_raw_store() -> Any:
    """
    Load raw JSON content from process_chains_store.json.
    Can be:
      - list (legacy format),
      - dict with key "runs",
      - anything else (treated as empty).
    """
    return load_json_store(CHAIN_STORE_NAME, default={"runs": []})


def _normalize_store(raw: Any) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Normalize store into:
      - dict store object (will be saved back),
      - list of runs.

    Supports:
      1) legacy format: [ {...}, {...} ]
      2) new format:    { "runs": [ {...}, {...} ] }
    """
    # Case 1: legacy list at root
    if isinstance(raw, list):
        runs: List[Dict[str, Any]] = []
        for item in raw:
            if isinstance(item, dict):
                runs.append(item)
        store: Dict[str, Any] = {"runs": runs}
        return store, runs

    # Case 2: dict with "runs"
    if isinstance(raw, dict):
        raw_runs = raw.get("runs", [])
        runs_list: List[Dict[str, Any]] = []
        if isinstance(raw_runs, list):
            for item in raw_runs:
                if isinstance(item, dict):
                    runs_list.append(item)
        raw["runs"] = runs_list
        return raw, runs_list

    # Fallback: anything else -> empty store
    store_fallback: Dict[str, Any] = {"runs": []}
    return store_fallback, store_fallback["runs"]


def _load_instances_total_count() -> int:
    """
    Return total count of process instances from process_instances_store.json.
    Works even if store is missing or in unexpected format.
    """
    raw = load_json_store(INSTANCES_STORE_NAME, default=[])
    if isinstance(raw, list):
        return len(raw)
    return 0


def get_dev_runs() -> List[Dict[str, Any]]:
    """
    Return list of dev chain runs from process_chains_store.json.
    Works with both legacy and new store formats.
    """
    raw = _load_raw_store()
    _, runs = _normalize_store(raw)
    return runs


def _append_dev_run_entry(entry: Dict[str, Any]) -> None:
    raw = _load_raw_store()
    store, runs = _normalize_store(raw)
    runs.append(entry)
    store["runs"] = runs
    save_json_store(CHAIN_STORE_NAME, store)


def run_dev_chain_for_client(client_id: str, year: int, month: int) -> Dict[str, Any]:
    """
    Dev executor: delegates real work to
    `python -m app.dev_create_test_process_all_clients`.

    This script already knows how to upsert process instances
    into process_instances_store.json for demo clients.

    Here we only:
      - capture instances total count before and after,
      - call the script,
      - record run metadata into process_chains_store.json.
    """
    started_at = datetime.utcnow().isoformat() + "Z"
    run_id = str(uuid.uuid4())
    status = "completed"
    error: str | None = None

    instances_before = _load_instances_total_count()

    try:
        subprocess.run(
            [sys.executable, "-m", "app.dev_create_test_process_all_clients"],
            check=True,
        )
    except Exception as exc:
        status = "error"
        error = repr(exc)

    finished_at = datetime.utcnow().isoformat() + "Z"
    instances_after = _load_instances_total_count()

    entry: Dict[str, Any] = {
        "id": run_id,
        "mode": "dev",
        "client_id": client_id,
        "year": year,
        "month": month,
        "status": status,
        "error": error,
        "engine": "dev_create_test_process_all_clients",
        "started_at": started_at,
        "finished_at": finished_at,
        "instances_before": instances_before,
        "instances_after": instances_after,
        "instances_delta": instances_after - instances_before,
    }

    _append_dev_run_entry(entry)
    return entry
