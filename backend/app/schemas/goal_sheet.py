from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GoalSheetBase(BaseModel):
    status: str


class GoalSheetCreate(BaseModel):
    pass  # Usually empty as it takes the current user and active cycle


class GoalSheetOut(GoalSheetBase):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    cycle_id: UUID
    cycle_label: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[UUID] = None
    progress_score: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class ReturnPayload(BaseModel):
    comment: str
