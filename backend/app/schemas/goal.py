from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GoalBase(BaseModel):
    thrust_area: str
    title: str
    description: Optional[str] = None
    uom_type: str  # min, max, timeline, zero
    target: str
    weightage: int


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    thrust_area: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    uom_type: Optional[str] = None
    target: Optional[str] = None
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

    model_config = ConfigDict(from_attributes=True)
