from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional

class UserBase(BaseModel):
    email: str
    full_name: str
    role: str # legacy role field for compatibility
    platform_role: Optional[str] = None # new platform role field
    job_title: Optional[str] = None
    is_active: bool = True
    employment_type: Optional[str] = None
    employee_code: Optional[str] = None
    location: Optional[str] = None
    manager_id: Optional[UUID] = None
    department_id: Optional[UUID] = None

class UserCreate(UserBase):
    pass

class UserOut(UserBase):
    id: UUID
    created_at: datetime
    department_name: Optional[str] = None
    manager_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    role: Optional[str] = None
    platform_role: Optional[str] = None
    job_title: Optional[str] = None
    is_active: Optional[bool] = None
    employment_type: Optional[str] = None
    employee_code: Optional[str] = None
    location: Optional[str] = None
    manager_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
