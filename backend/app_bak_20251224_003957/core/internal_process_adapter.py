from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Dict, Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)


def _background_generate_tasks(
    base_url: str,
    process_instance_id: str,
    payload: Optional[Dict[str, Any]],
) -> None:
    """
    Background worker that calls generate-tasks endpoint.

    Runs in a separate thread to avoid blocking the main request
    and to prevent self-call deadlocks on the same uvicorn worker.
    """
    instance_id = (process_instance_id or "").strip()
    if not instance_id:
        logger.debug("background_generate_tasks: empty process_instance_id, skipping")
        return

    try:
        import requests  # type: ignore[import]
    except Exception:
        logger.debug("background_generate_tasks: requests library is not available")
        return

    url = f"{base_url.rstrip('/')}/api/internal/process-instances/{quote(instance_id, safe='')}/generate-tasks"
    body: Dict[str, Any] = {
        "source": "chain",
        "payload": payload or {},
    }

    # Short delay to allow the original request to finish.
    time.sleep(0.2)

    try:
        logger.info(
            "PROCESS_TASK_GENERATION_BG_START: url=%s instance_id=%s",
            url,
            instance_id,
        )
        response = requests.post(url, json=body, timeout=10.0)
        if response.status_code >= 400:
            logger.warning(
                "PROCESS_TASK_GENERATION_BG_FAILED: status=%s body=%s",
                response.status_code,
                response.text,
            )
            return

        logger.info(
            "PROCESS_TASK_GENERATION_BG_OK: instance_id=%s status=%s",
            instance_id,
            response.status_code,
        )
    except Exception as exc:
        logger.warning("PROCESS_TASK_GENERATION_BG_EXCEPTION: %s", exc)


def trigger_generate_tasks_from_chain(
    *,
    process_instance_id: str,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Fire-and-forget bridge from chains to internal process generate-tasks endpoint.

    Behavior:
      - Spawn a background thread that will call
        POST /api/internal/process-instances/{id}/generate-tasks
        against the current backend.
      - Return immediately so chain execution is not blocked.
    """
    instance_id = (process_instance_id or "").strip()
    if not instance_id:
        logger.debug("trigger_generate_tasks_from_chain: empty process_instance_id, skipping")
        return

    base_url = os.getenv("ERP_INTERNAL_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

    thread = threading.Thread(
        target=_background_generate_tasks,
        args=(base_url, instance_id, dict(payload or {})),
        daemon=True,
    )
    thread.start()

    logger.info(
        "PROCESS_TASK_GENERATION_BG_SCHEDULED: instance_id=%s base_url=%s",
        instance_id,
        base_url,
    )
