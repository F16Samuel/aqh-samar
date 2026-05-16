from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class CompletionSummaryResponse(BaseModel):
    employee_id: UUID
    employee_name: str
    manager_name: Optional[str] = None
    sheet_status: str
    checkins_completed: int
    checkins_pending: int
    last_checkin_at: Optional[datetime] = None
