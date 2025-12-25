from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ControlEventModel(BaseModel):
    id: str
    client_id: str
    date: date
    title: str
    category: Optional[str] = None
    status: str
    depends_on: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source: Optional[str] = None


class ControlEventsResponse(BaseModel):
    client_id: str
    year: Optional[int] = None
    month: Optional[int] = None
    events: List[ControlEventModel] = Field(default_factory=list)


class GeneratedTaskModel(BaseModel):
    id: str
    client_id: str
    title: str
    description: Optional[str] = None
    status: str
    assignee: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    due_date: Optional[date] = None
    source_event_id: Optional[str] = None
    source: Optional[str] = None


class GenerateTasksResponse(BaseModel):
    client_id: str
    year: Optional[int] = None
    month: Optional[int] = None
    tasks_suggested: int
    tasks: List[GeneratedTaskModel] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    detail: str
