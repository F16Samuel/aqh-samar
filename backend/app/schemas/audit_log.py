from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class AuditLogBase(BaseModel):
    goal_id: UUID
    changed_by: UUID
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogOut(AuditLogBase):
    id: UUID
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)
