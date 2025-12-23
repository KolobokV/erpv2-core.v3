from __future__ import annotations

from typing import List, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/onboarding", tags=["onboarding"])

TaxMode = Literal["usn_dr", "usn_income", "vat"]


class IntakeIn(BaseModel):
    client_id: str = Field(..., min_length=3, max_length=40)
    tax_mode: TaxMode
    employees: int = Field(0, ge=0, le=500)
    payroll_day1: int = Field(10, ge=1, le=31)
    payroll_day2: int = Field(25, ge=1, le=31)


class PreviewItem(BaseModel):
    title: str
    due: str


class DeriveOut(BaseModel):
    client_id: str
    events: int
    tasks: int
    items: List[PreviewItem]


@router.post("/derive-preview", response_model=DeriveOut)
def derive_preview(payload: IntakeIn) -> DeriveOut:
    year = 2026
    month = 1

    def mk(day: int) -> str:
        dd = max(1, min(28, int(day)))
        return f"{year:04d}-{month:02d}-{dd:02d}"

    items: List[PreviewItem] = [PreviewItem(title="Bank statement request", due=mk(2))]

    if payload.employees > 0:
        items.append(PreviewItem(title="Payroll processing", due=mk(payload.payroll_day1)))
        items.append(PreviewItem(title="Payroll processing", due=mk(payload.payroll_day2)))

    if payload.tax_mode == "vat":
        items.append(PreviewItem(title="VAT declaration", due=mk(25)))
    else:
        items.append(PreviewItem(title="USN advance payment", due=mk(28)))

    events = len(items)
    tasks = max(1, events // 2)

    return DeriveOut(client_id=payload.client_id, events=events, tasks=tasks, items=items)
