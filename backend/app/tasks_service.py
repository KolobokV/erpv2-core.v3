from __future__ import annotations

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.events import get_event_system, EventTypes
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate


class TaskService:
    def __init__(self, db: Session):
        self.db = db
        self.events = get_event_system()

    # ---------------------------
    # CREATE TASK
    # ---------------------------
    async def create_task(self, data: TaskCreate) -> Task:
        task = Task(
            title=data.title,
            description=data.description,
            client_id=data.client_id,
            assigned_to=data.assigned_to,
            deadline=data.deadline,
            priority=data.priority,
            status="not_started",
            is_auto_generated=data.is_auto_generated or False,
            chain_id=data.chain_id,
            chain_step_id=data.chain_step_id,
            group_key=data.group_key,
            tags=data.tags or [],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)

        # Publish event
        await self.events.publish(EventTypes.TASK_CREATED, {
            "task_id": str(task.id),
            "client_id": str(task.client_id),
            "assigned_to": str(task.assigned_to),
            "status": task.status,
        })

        return task

    # ---------------------------
    # UPDATE STATUS
    # ---------------------------
    async def update_status(self, task_id: UUID, new_status: str) -> Optional[Task]:
        task: Task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None

        old_status = task.status
        task.status = new_status
        task.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(task)

        # Publish event
        await self.events.publish(EventTypes.TASK_STATUS_CHANGED, {
            "task_id": str(task.id),
            "client_id": str(task.client_id),
            "old_status": old_status,
            "new_status": new_status,
        })

        return task
