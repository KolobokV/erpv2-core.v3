from typing import List, Optional
from pydantic import BaseModel


# ---- TASKS ----

class TaskModel(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    assignee: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    due_date: Optional[str] = None


# ---- CLIENT PROFILES ----

class ClientProfile(BaseModel):
    id: str
    name: str
    inn: Optional[str] = None
    kpp: Optional[str] = None
    regime: Optional[str] = None
    risk_level: Optional[str] = None
    notes: Optional[str] = None


class ClientProfileList(BaseModel):
    items: List[ClientProfile]


# ---- PROCESS DEFINITIONS ----

class ProcessStage(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class ProcessDefinition(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    stages: List[ProcessStage]


# ---- PROCESS INSTANCES ----

class ProcessStageInstance(BaseModel):
    id: str
    stage_id: str
    completed: bool = False
    completed_at: Optional[str] = None


class ProcessInstance(BaseModel):
    id: str
    definition_id: str
    month: str
    year: int
    stages: List[ProcessStageInstance]


class ProcessDefinitionList(BaseModel):
    items: List[ProcessDefinition]


class ProcessInstanceList(BaseModel):
    items: List[ProcessInstance]
