from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import GoalSheet, CheckIn
from app.models.cycle import Cycle
from app.schemas.checkin import CheckInCreate, CheckInOut
from app.core.utils import is_window_open

router = APIRouter()

@router.post("/")
@require_roles("manager", "admin")
async def create_checkin(payload: CheckInCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user

    # Validate check-in window for this specific quarter
    cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = cycle_res.scalar_one_or_none()
    if not cycle:
        return err("NO_ACTIVE_CYCLE", "No active performance cycle found.", 400)
    quarter_key = payload.quarter.lower().replace(" ", "_").replace("-", "_")
    if not is_window_open(cycle, quarter_key):
        return err("WINDOW_CLOSED", f"The check-in window for {payload.quarter} is not currently open.", 422)

    sheet_res = await db.execute(select(GoalSheet).where(GoalSheet.id == payload.sheet_id))
    sheet = sheet_res.scalar_one_or_none()
    
    if not sheet:
        return err("NOT_FOUND", "Goal sheet not found", 404)
        
    if user.platform_role != "admin":
        from app.models.user import User
        emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
        emp = emp_res.scalar_one()
        if emp.manager_id != user.id:
            return err("FORBIDDEN", "Only the direct manager can add a check-in", 403)
            
    checkin = CheckIn(
        sheet_id=sheet.id,
        manager_id=user.id,
        quarter=payload.quarter,
        comment=payload.comment
    )
    db.add(checkin)
    await db.commit()
    await db.refresh(checkin)
    
    return ok(CheckInOut.model_validate(checkin).model_dump(mode="json"), 201)


@router.get("/sheet/{sheet_id}")
@require_roles("employee", "manager", "admin")
async def list_checkins(sheet_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    # Assuming user has access logic check omitted for brevity
    res = await db.execute(select(CheckIn).where(CheckIn.sheet_id == sheet_id).order_by(CheckIn.created_at))
    checkins = res.scalars().all()
    return ok([CheckInOut.model_validate(c).model_dump(mode="json") for c in checkins])
