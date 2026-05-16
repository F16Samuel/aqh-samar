from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import GoalSheet, Goal
from app.models.cycle import Cycle
from app.schemas.goal import GoalCreate, GoalUpdate, GoalSharedCreate, GoalOut

router = APIRouter()

@router.post("/sheet/{sheet_id}")
@require_roles("employee", "manager", "admin")
async def create_goal(sheet_id: UUID, payload: GoalCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    
    res = await db.execute(select(GoalSheet).where(GoalSheet.id == sheet_id))
    sheet = res.scalar_one_or_none()
    
    if not sheet:
        return err("NOT_FOUND", "Sheet not found", 404)
        
    if sheet.employee_id != user.id and user.role != "admin":
        return err("FORBIDDEN", "Only the sheet owner can add goals", 403)
        
    if sheet.status not in ("draft", "rework"):
        return err("INVALID_STATUS", f"Cannot add goals in {sheet.status} status", 400)
        
    res_goals = await db.execute(select(Goal).where(Goal.sheet_id == sheet.id))
    current_goals = res_goals.scalars().all()
    if len(current_goals) >= 8:
        return err("LIMIT_EXCEEDED", "Maximum 8 goals allowed per sheet", 400)
        
    goal = Goal(
        sheet_id=sheet.id,
        thrust_area=payload.thrust_area,
        title=payload.title,
        description=payload.description,
        uom_type=payload.uom_type,
        target=payload.target,
        weightage=payload.weightage,
        is_locked=False
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    
    return ok(GoalOut.model_validate(goal).model_dump(mode="json"), 201)

@router.patch("/{goal_id}")
@require_roles("employee", "manager", "admin")
async def update_goal(goal_id: UUID, payload: GoalUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    
    res = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = res.scalar_one_or_none()
    
    if not goal:
        return err("NOT_FOUND", "Goal not found", 404)
        
    res_sheet = await db.execute(select(GoalSheet).where(GoalSheet.id == goal.sheet_id))
    sheet = res_sheet.scalar_one()
    
    is_owner = (sheet.employee_id == user.id)
    is_manager = False
    
    if not is_owner and user.role != "admin":
        from app.models.user import User
        emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
        emp = emp_res.scalar_one()
        if emp.manager_id == user.id:
            is_manager = True
        else:
            return err("FORBIDDEN", "You do not have access to edit this goal", 403)
            
    if goal.is_locked and user.role != "admin":
        return err("LOCKED", "Goal is locked and cannot be edited", 400)
        
    update_data = payload.model_dump(exclude_unset=True)
    
    if goal.shared_from is not None:
        if "title" in update_data or "target" in update_data:
            return err("READ_ONLY", "Title and Target are read-only for shared goals", 400)
            
    for key, value in update_data.items():
        setattr(goal, key, value)
        
    await db.commit()
    await db.refresh(goal)
    return ok(GoalOut.model_validate(goal).model_dump(mode="json"))

@router.delete("/{goal_id}")
@require_roles("employee", "manager", "admin")
async def delete_goal(goal_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    res = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = res.scalar_one_or_none()
    
    if not goal:
        return err("NOT_FOUND", "Goal not found", 404)
        
    res_sheet = await db.execute(select(GoalSheet).where(GoalSheet.id == goal.sheet_id))
    sheet = res_sheet.scalar_one()
    
    if sheet.employee_id != user.id and user.role != "admin":
        return err("FORBIDDEN", "Only the sheet owner can delete goals", 403)
        
    if goal.is_locked and user.role != "admin":
        return err("LOCKED", "Goal is locked and cannot be deleted", 400)
        
    await db.delete(goal)
    await db.commit()
    return ok({"message": "Goal deleted successfully"})

@router.post("/shared")
@require_roles("admin", "manager")
async def share_goal(payload: GoalSharedCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """Admin/Manager fans out a goal to a list of employee sheets."""
    res_src = await db.execute(select(Goal).where(Goal.id == payload.source_goal_id))
    src_goal = res_src.scalar_one_or_none()
    
    if not src_goal:
        return err("NOT_FOUND", "Source goal not found", 404)
        
    cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = cycle_res.scalar_one_or_none()
    if not cycle:
        return err("NO_ACTIVE_CYCLE", "There is no active cycle", 400)
        
    shared_goals = []
    
    for emp_id in payload.employee_ids:
        sheet_res = await db.execute(
            select(GoalSheet).where(GoalSheet.employee_id == emp_id, GoalSheet.cycle_id == cycle.id)
        )
        sheet = sheet_res.scalar_one_or_none()
        
        if not sheet:
            sheet = GoalSheet(employee_id=emp_id, cycle_id=cycle.id, status="draft")
            db.add(sheet)
            await db.flush()
            
        res_count = await db.execute(select(Goal).where(Goal.sheet_id == sheet.id))
        count = len(res_count.scalars().all())
        if count >= 8:
            continue
            
        new_goal = Goal(
            sheet_id=sheet.id,
            shared_from=src_goal.id,
            thrust_area=src_goal.thrust_area,
            title=src_goal.title,
            description=src_goal.description,
            uom_type=src_goal.uom_type,
            target=src_goal.target,
            weightage=payload.weightage,
            is_locked=False
        )
        db.add(new_goal)
        shared_goals.append(new_goal)
        
    await db.commit()
    return ok({"message": f"Shared goal with {len(shared_goals)} employees"})
