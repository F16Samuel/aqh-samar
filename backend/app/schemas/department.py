from uuid import UUID
from pydantic import BaseModel, ConfigDict

class DepartmentBase(BaseModel):
    name: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
