from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GoalBase(BaseModel):
    thrust_area: str
    title: str
    description: Optional[str] = None
    uom_type: str  # min, max, timeline, zero
    target: float = Field(gt=0)
    weightage: int

    @field_validator('target', mode='before')
    @classmethod
    def coerce_target(cls, v):
        try:
            val = float(v)
            if val <= 0:
                return 0.01
            return val
        except (ValueError, TypeError):
            return 0.01


class GoalCreate(GoalBase):
    sheet_id: UUID


class GoalUpdate(BaseModel):
    thrust_area: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    uom_type: Optional[str] = None
    target: Optional[float] = Field(default=None, gt=0)
    weightage: Optional[int] = None


class GoalSharedCreate(BaseModel):
    source_goal_id: UUID
    employee_ids: List[UUID]
    weightage: int = 10  # default weightage for the shared goal


class GoalOut(GoalBase):
    id: UUID
    sheet_id: UUID
    shared_from: Optional[UUID] = None
    is_locked: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
