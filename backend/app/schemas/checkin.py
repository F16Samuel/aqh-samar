from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CheckInBase(BaseModel):
    quarter: str
    comment: str

class CheckInCreate(CheckInBase):
    sheet_id: UUID

class CheckInOut(CheckInBase):
    id: UUID
    sheet_id: UUID
    manager_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
