from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AchievementBase(BaseModel):
    quarter: str
    actual: Optional[str] = None
    status: str = "not_started"

class AchievementCreate(BaseModel):
    goal_id: UUID
    quarter: str
    actual: Optional[str] = None
    status: str = "not_started"

class AchievementUpdate(BaseModel):
    actual: Optional[str] = None
    status: Optional[str] = None

class AchievementOut(AchievementBase):
    id: UUID
    goal_id: UUID
    cycle_id: UUID
    updated_at: datetime
    progress_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
