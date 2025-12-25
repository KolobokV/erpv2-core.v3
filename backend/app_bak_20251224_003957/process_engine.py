from datetime import datetime
from typing import List, Dict


def generate_tasks(definition: Dict) -> List[Dict]:
    """
    Simple placeholder engine.
    Later will use full rule logic depending on client profile.
    """
    tasks = []
    stages = definition.get("stages", [])

    for idx, stage in enumerate(stages, start=1):
        tasks.append(
            {
                "task_id": f"{definition['id']}-stage-{idx}",
                "title": stage.get("title", f"Stage {idx}"),
                "created_at": datetime.utcnow().isoformat(),
            }
        )
    return tasks
