from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import GoalSheet, Goal, Achievement
from app.schemas.achievement import AchievementCreate, AchievementUpdate, AchievementOut
from app.core.utils import compute_progress_score

router = APIRouter()

async def _auto_sync_shared_goals(db: AsyncSession, source_goal_id: UUID, quarter: str, actual: str, status: str):
    """Sync achievement updates to all goals shared from the given source goal."""
    res_shared = await db.execute(select(Goal).where(Goal.shared_from == source_goal_id))
    shared_goals = res_shared.scalars().all()
    
    for sg in shared_goals:
        # Check if achievement exists for this quarter
        ach_res = await db.execute(
            select(Achievement).where(Achievement.goal_id == sg.id, Achievement.quarter == quarter)
        )
        ach = ach_res.scalar_one_or_none()
        
        if ach:
            ach.actual = actual
            ach.status = status
            ach.updated_at = datetime.utcnow()
        else:
            # Create new achievement
            # We need cycle_id. It's the same as the sheet's cycle_id
            sheet_res = await db.execute(select(GoalSheet).where(GoalSheet.id == sg.sheet_id))
            sheet = sheet_res.scalar_one()
            
            new_ach = Achievement(
                goal_id=sg.id,
                cycle_id=sheet.cycle_id,
                quarter=quarter,
                actual=actual,
                status=status
            )
            db.add(new_ach)


@router.get("/goal/{goal_id}")
@require_roles("employee", "manager", "admin")
async def list_achievements(goal_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    
    # Validation logic for permissions omitted for brevity, assumes user has access
    res = await db.execute(select(Achievement).where(Achievement.goal_id == goal_id).order_by(Achievement.quarter))
    achievements = res.scalars().all()
    
    goal_res = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = goal_res.scalar_one()
    
    result_list = []
    for a in achievements:
        data = AchievementOut.model_validate(a).model_dump()
        data["progress_score"] = compute_progress_score(goal.uom_type, goal.target, a.actual)
        result_list.append(data)
        
    return ok(result_list)

@router.post("/")
@require_roles("employee", "manager", "admin")
async def create_achievement(payload: AchievementCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    
    goal_res = await db.execute(select(Goal).where(Goal.id == payload.goal_id))
    goal = goal_res.scalar_one_or_none()
    
    if not goal:
        return err("NOT_FOUND", "Goal not found", 404)
        
    sheet_res = await db.execute(select(GoalSheet).where(GoalSheet.id == goal.sheet_id))
    sheet = sheet_res.scalar_one()
    
    if sheet.employee_id != user.id and user.role != "admin":
        return err("FORBIDDEN", "Only goal owner can add achievements", 403)
        
    if goal.shared_from is not None:
        return err("READ_ONLY", "Cannot manually update achievement for a shared goal. Update the master goal instead.", 400)
        
    ach_res = await db.execute(
        select(Achievement).where(Achievement.goal_id == goal.id, Achievement.quarter == payload.quarter)
    )
    if ach_res.scalar_one_or_none():
        return err("ALREADY_EXISTS", f"Achievement for {payload.quarter} already exists", 400)
        
    ach = Achievement(
        goal_id=goal.id,
        cycle_id=sheet.cycle_id,
        quarter=payload.quarter,
        actual=payload.actual,
        status=payload.status
    )
    db.add(ach)
    
    if payload.actual is not None:
        await _auto_sync_shared_goals(db, goal.id, payload.quarter, payload.actual, payload.status)
        
    await db.commit()
    await db.refresh(ach)
    
    out = AchievementOut.model_validate(ach).model_dump()
    out["progress_score"] = compute_progress_score(goal.uom_type, goal.target, ach.actual)
    return ok(out, 201)

@router.patch("/{ach_id}")
@require_roles("employee", "manager", "admin")
async def update_achievement(ach_id: UUID, payload: AchievementUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    
    res = await db.execute(select(Achievement).where(Achievement.id == ach_id))
    ach = res.scalar_one_or_none()
    
    if not ach:
        return err("NOT_FOUND", "Achievement not found", 404)
        
    goal_res = await db.execute(select(Goal).where(Goal.id == ach.goal_id))
    goal = goal_res.scalar_one()
    
    if goal.shared_from is not None:
        return err("READ_ONLY", "Cannot manually update achievement for a shared goal.", 400)
        
    sheet_res = await db.execute(select(GoalSheet).where(GoalSheet.id == goal.sheet_id))
    sheet = sheet_res.scalar_one()
    
    if sheet.employee_id != user.id and user.role != "admin":
        return err("FORBIDDEN", "Only goal owner can edit achievements", 403)
        
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(ach, k, v)
        
    ach.updated_at = datetime.utcnow()
    
    if ach.actual is not None:
        await _auto_sync_shared_goals(db, goal.id, ach.quarter, ach.actual, ach.status)
        
    await db.commit()
    await db.refresh(ach)
    
    out = AchievementOut.model_validate(ach).model_dump()
    out["progress_score"] = compute_progress_score(goal.uom_type, goal.target, ach.actual)
    return ok(out)
