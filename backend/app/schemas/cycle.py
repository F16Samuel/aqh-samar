from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CycleBase(BaseModel):
    year: int
    phase: str
    window_open: date
    window_close: date
    is_active: bool = False


class CycleCreate(CycleBase):
    pass


class CycleUpdate(BaseModel):
    year: Optional[int] = None
    phase: Optional[str] = None
    window_open: Optional[date] = None
    window_close: Optional[date] = None
    is_active: Optional[bool] = None


class CycleOut(CycleBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
