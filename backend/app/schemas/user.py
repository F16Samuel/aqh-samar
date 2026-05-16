from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional

class UserBase(BaseModel):
    email: str
    full_name: str
    role: str
    manager_id: Optional[UUID] = None
    department_id: Optional[UUID] = None

class UserOut(UserBase):
    id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
