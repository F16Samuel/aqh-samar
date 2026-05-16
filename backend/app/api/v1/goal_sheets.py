from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import GoalSheet, Goal, CheckIn
from app.models.cycle import Cycle
from app.schemas.goal_sheet import GoalSheetOut, ReturnPayload

router = APIRouter()

@router.post("/")
@require_roles("employee", "manager", "admin")
async def create_goal_sheet(request: Request, db: AsyncSession = Depends(get_db)):
    """Employee creates a draft goal sheet for the active cycle."""
    user = request.state.user
    
    cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = cycle_res.scalar_one_or_none()
    
    if not cycle:
        return err("NO_ACTIVE_CYCLE", "There is no active cycle for goal setting.", 400)
        
    sheet_res = await db.execute(
        select(GoalSheet).where(
            GoalSheet.employee_id == user.id,
            GoalSheet.cycle_id == cycle.id
        )
    )
    existing_sheet = sheet_res.scalar_one_or_none()
    
    if existing_sheet:
        return err("ALREADY_EXISTS", "A goal sheet already exists for the active cycle.", 400)
        
    new_sheet = GoalSheet(
        employee_id=user.id,
        cycle_id=cycle.id,
        status="draft"
    )
    db.add(new_sheet)
    await db.commit()
    await db.refresh(new_sheet)
    
    return ok(GoalSheetOut.model_validate(new_sheet).model_dump(mode="json"), 201)

@router.get("/mine")
@require_roles("employee", "manager", "admin")
async def get_my_sheets(request: Request, db: AsyncSession = Depends(get_db)):
    """Get all goal sheets for the current user."""
    user = request.state.user
    res = await db.execute(
        select(GoalSheet)
        .where(GoalSheet.employee_id == user.id)
        .order_by(GoalSheet.submitted_at.desc().nullslast())
    )
    sheets = res.scalars().all()
    return ok([GoalSheetOut.model_validate(s).model_dump(mode="json") for s in sheets])

@router.get("/team")
@require_roles("manager", "admin")
async def get_team_sheets(request: Request, db: AsyncSession = Depends(get_db)):
    """Get goal sheets of direct reports."""
    user = request.state.user
    from app.models.user import User
    res = await db.execute(
        select(GoalSheet).join(User, GoalSheet.employee_id == User.id)
        .where(User.manager_id == user.id)
        .order_by(GoalSheet.submitted_at.desc().nullslast())
    )
    sheets = res.scalars().all()
    return ok([GoalSheetOut.model_validate(s).model_dump(mode="json") for s in sheets])

@router.get("/{sheet_id}")
@require_roles("employee", "manager", "admin")
async def get_sheet(sheet_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Get specific goal sheet."""
    user = request.state.user
    res = await db.execute(select(GoalSheet).where(GoalSheet.id == sheet_id))
    sheet = res.scalar_one_or_none()
    
    if not sheet:
        return err("NOT_FOUND", "Goal sheet not found", 404)
        
    if user.role != "admin" and sheet.employee_id != user.id:
        from app.models.user import User
        emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
        emp = emp_res.scalar_one()
        if emp.manager_id != user.id:
            return err("FORBIDDEN", "You do not have access to this sheet", 403)
            
    return ok(GoalSheetOut.model_validate(sheet).model_dump(mode="json"))

@router.post("/{sheet_id}/submit")
@require_roles("employee", "manager", "admin")
async def submit_sheet(sheet_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    res = await db.execute(select(GoalSheet).where(GoalSheet.id == sheet_id))
    sheet = res.scalar_one_or_none()
    
    if not sheet:
        return err("NOT_FOUND", "Goal sheet not found", 404)
        
    if sheet.employee_id != user.id and user.role != "admin":
        return err("FORBIDDEN", "Only the owner can submit the sheet", 403)
        
    if sheet.status not in ("draft", "rework"):
        return err("INVALID_STATUS", f"Cannot submit sheet in {sheet.status} status", 400)
        
    goals_res = await db.execute(select(Goal).where(Goal.sheet_id == sheet.id))
    goals = goals_res.scalars().all()
    
    if not goals:
        return err("VALIDATION_ERROR", "Cannot submit an empty goal sheet", 400)
        
    if len(goals) > 8:
        return err("VALIDATION_ERROR", "Maximum 8 goals allowed", 400)
        
    total_weightage = 0
    for g in goals:
        if g.weightage < 10:
            return err("VALIDATION_ERROR", f"Goal '{g.title}' has weightage < 10%", 400)
        total_weightage += g.weightage
        
    if total_weightage != 100:
        return err("VALIDATION_ERROR", f"Total weightage must be 100%. Current is {total_weightage}%", 400)
        
    sheet.status = "submitted"
    sheet.submitted_at = datetime.utcnow()
    await db.commit()
    await db.refresh(sheet)
    
    return ok(GoalSheetOut.model_validate(sheet).model_dump(mode="json"))

@router.post("/{sheet_id}/approve")
@require_roles("manager", "admin")
async def approve_sheet(sheet_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    res = await db.execute(select(GoalSheet).where(GoalSheet.id == sheet_id))
    sheet = res.scalar_one_or_none()
    
    if not sheet:
        return err("NOT_FOUND", "Goal sheet not found", 404)
        
    if user.role != "admin":
        from app.models.user import User
        emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
        emp = emp_res.scalar_one()
        if emp.manager_id != user.id:
            return err("FORBIDDEN", "Only the direct manager can approve", 403)
            
    if sheet.status != "submitted":
        return err("INVALID_STATUS", f"Cannot approve sheet in {sheet.status} status", 400)
        
    sheet.status = "approved"
    sheet.approved_at = datetime.utcnow()
    sheet.approved_by = user.id
    
    # Lock all goals
    await db.execute(update(Goal).where(Goal.sheet_id == sheet.id).values(is_locked=True))
    
    await db.commit()
    await db.refresh(sheet)
    return ok(GoalSheetOut.model_validate(sheet).model_dump(mode="json"))

@router.post("/{sheet_id}/return")
@require_roles("manager", "admin")
async def return_sheet(sheet_id: UUID, payload: ReturnPayload, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    res = await db.execute(select(GoalSheet).where(GoalSheet.id == sheet_id))
    sheet = res.scalar_one_or_none()
    
    if not sheet:
        return err("NOT_FOUND", "Goal sheet not found", 404)
        
    if user.role != "admin":
        from app.models.user import User
        emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
        emp = emp_res.scalar_one()
        if emp.manager_id != user.id:
            return err("FORBIDDEN", "Only the direct manager can return the sheet", 403)
            
    if sheet.status != "submitted":
        return err("INVALID_STATUS", f"Cannot return sheet in {sheet.status} status", 400)
        
    sheet.status = "rework"
    
    checkin = CheckIn(
        sheet_id=sheet.id,
        manager_id=user.id,
        quarter="Goal Setting",
        comment=payload.comment
    )
    db.add(checkin)
    
    # Ensure goals are unlocked
    await db.execute(update(Goal).where(Goal.sheet_id == sheet.id).values(is_locked=False))
    
    await db.commit()
    await db.refresh(sheet)
    return ok(GoalSheetOut.model_validate(sheet).model_dump(mode="json"))
