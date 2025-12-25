from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Dict, List

from app.services.chain_executor_v2 import run_reglament_for_period

BASE_DIR = Path(__file__).resolve().parent.parent
RESULT_PATH = BASE_DIR / "dev_stress_reglament_result.json"


async def run_stress(
    year: int,
    month: int,
    iterations: int = 10,
) -> Dict[str, Any]:
    """
    Simple in-process stress runner for monthly reglament.

    It calls run_reglament_for_period many times in a row and prints
    basic timing and status information. Final summary is also written
    to dev_stress_reglament_result.json in backend root.
    """
    results: List[Dict[str, Any]] = []
    start_all = time.perf_counter()

    print("")
    print("=== REGLEMENT STRESS RUNNER ===")
    print(f"Period: {year:04d}-{month:02d}")
    print(f"Iterations: {iterations}")
    print("================================")
    print("")

    for i in range(iterations):
        iter_start = time.perf_counter()
        print(f"[STRESS] Iteration {i + 1}/{iterations} for {year:04d}-{month:02d}")

        status = "ok"
        error: str | None = None
        result_payload: Any = None

        try:
            result_payload = await run_reglament_for_period(year=year, month=month)
        except Exception as exc:
            status = "error"
            error = str(exc)

        iter_end = time.perf_counter()

        item: Dict[str, Any] = {
            "iteration": i + 1,
            "status": status,
            "error": error,
            "duration_sec": round(iter_end - iter_start, 3),
        }
        results.append(item)

        if status == "error":
            print(f"  -> ERROR: {error}")
        else:
            print(f"  -> OK in {item['duration_sec']} sec")

    end_all = time.perf_counter()

    ok_count = len([r for r in results if r["status"] == "ok"])
    err_count = len([r for r in results if r["status"] != "ok"])

    summary: Dict[str, Any] = {
        "year": year,
        "month": month,
        "iterations": iterations,
        "duration_total_sec": round(end_all - start_all, 3),
        "ok_count": ok_count,
        "error_count": err_count,
        "runs": results,
    }

    print("")
    print("=== STRESS SUMMARY ===")
    print(f"Period: {year:04d}-{month:02d}")
    print(f"Iterations: {iterations}")
    print(f"OK: {ok_count}, ERRORS: {err_count}")
    print(f"Total duration: {summary['duration_total_sec']} sec")
    print(f"Results saved to: {RESULT_PATH}")
    print("========================")
    print("")

    try:
        RESULT_PATH.write_text(
            json.dumps(summary, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        print(f"[WARN] Failed to write result file: {exc}")

    return summary


async def main() -> None:
    # Default reference period; can be changed if needed
    year = 2025
    month = 12
    iterations = 10

    await run_stress(year=year, month=month, iterations=iterations)


if __name__ == "__main__":
    asyncio.run(main())
