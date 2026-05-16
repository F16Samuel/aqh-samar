from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import GoalSheet, Goal, Achievement, AuditLog
from app.models.user import User
from app.models.department import Department
from app.models.cycle import Cycle
from app.core.utils import compute_progress_score

router = APIRouter()

@router.get("/department")
@require_roles("employee", "manager", "admin")
async def department_report(request: Request, db: AsyncSession = Depends(get_db)):
    """Compute aggregate scores for the user's department in the active cycle."""
    user = request.state.user
    
    cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = cycle_res.scalar_one_or_none()
    if not cycle:
        return err("NO_ACTIVE_CYCLE", "There is no active cycle", 400)
        
    # Get all users in the same department
    users_res = await db.execute(select(User.id).where(User.department_id == user.department_id))
    user_ids = users_res.scalars().all()
    
    if not user_ids:
        return ok({"average_score": 0.0, "total_goals": 0})
        
    # Get all sheets for these users in active cycle
    sheets_res = await db.execute(
        select(GoalSheet.id).where(GoalSheet.employee_id.in_(user_ids), GoalSheet.cycle_id == cycle.id)
    )
    sheet_ids = sheets_res.scalars().all()
    
    if not sheet_ids:
        return ok({"average_score": 0.0, "total_goals": 0})
        
    # Get all goals
    goals_res = await db.execute(select(Goal).where(Goal.sheet_id.in_(sheet_ids)))
    goals = goals_res.scalars().all()
    
    total_score = 0.0
    total_weight = 0
    
    for g in goals:
        # Get latest achievement
        ach_res = await db.execute(
            select(Achievement).where(Achievement.goal_id == g.id).order_by(Achievement.updated_at.desc())
        )
        latest_ach = ach_res.scalars().first()
        
        actual = latest_ach.actual if latest_ach else None
        score = compute_progress_score(g.uom_type, g.target, actual)
        
        # Weighted score contribution
        total_score += (score * g.weightage / 100)
        total_weight += g.weightage
        
    avg = total_score / (len(goals)) if goals else 0.0
    # Wait, the weighted score per goal adds up to max 100 per sheet. 
    # Average score across the department would be (sum of sheet scores) / number of sheets.
    # We can approximate by taking average of the weighted contributions. 
    # But a proper way is calculate each sheet's total score, then average those.
    # Let's simplify:
    sheet_scores = {sid: 0.0 for sid in sheet_ids}
    for g in goals:
        ach_res = await db.execute(select(Achievement).where(Achievement.goal_id == g.id).order_by(Achievement.updated_at.desc()))
        latest_ach = ach_res.scalars().first()
        actual = latest_ach.actual if latest_ach else None
        score = compute_progress_score(g.uom_type, g.target, actual)
        sheet_scores[g.sheet_id] += (score * g.weightage / 100)
        
    avg_score = sum(sheet_scores.values()) / len(sheet_scores) if sheet_scores else 0.0
    
    return ok({
        "department_id": user.department_id,
        "average_score": round(avg_score, 2),
        "total_sheets": len(sheet_scores),
        "total_goals": len(goals)
    })

@router.get("/company")
@require_roles("admin")
async def company_report(request: Request, db: AsyncSession = Depends(get_db)):
    """Compute overall metrics for the entire company in the active cycle."""
    cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = cycle_res.scalar_one_or_none()
    if not cycle:
        return err("NO_ACTIVE_CYCLE", "There is no active cycle", 400)
        
    sheets_res = await db.execute(select(GoalSheet.id).where(GoalSheet.cycle_id == cycle.id))
    sheet_ids = sheets_res.scalars().all()
    
    if not sheet_ids:
        return ok({"average_score": 0.0, "total_sheets": 0})
        
    goals_res = await db.execute(select(Goal).where(Goal.sheet_id.in_(sheet_ids)))
    goals = goals_res.scalars().all()
    
    sheet_scores = {sid: 0.0 for sid in sheet_ids}
    for g in goals:
        ach_res = await db.execute(select(Achievement).where(Achievement.goal_id == g.id).order_by(Achievement.updated_at.desc()))
        latest_ach = ach_res.scalars().first()
        actual = latest_ach.actual if latest_ach else None
        score = compute_progress_score(g.uom_type, g.target, actual)
        sheet_scores[g.sheet_id] += (score * g.weightage / 100)
        
    avg_score = sum(sheet_scores.values()) / len(sheet_scores) if sheet_scores else 0.0
    
    return ok({
        "average_score": round(avg_score, 2),
        "total_sheets": len(sheet_scores),
        "total_goals": len(goals)
    })

@router.get("/audit/{goal_id}")
@require_roles("admin", "manager")
async def get_audit_logs(goal_id: UUID, db: AsyncSession = Depends(get_db)):
    """Full change log for a specific goal."""
    res = await db.execute(select(AuditLog).where(AuditLog.goal_id == goal_id).order_by(AuditLog.changed_at.desc()))
    logs = res.scalars().all()
    
    # We can map it directly to a dictionary since Pydantic schema is simple
    return ok([{
        "id": str(log.id),
        "goal_id": str(log.goal_id),
        "changed_by": str(log.changed_by),
        "field_name": log.field_name,
        "old_value": log.old_value,
        "new_value": log.new_value,
        "changed_at": log.changed_at.isoformat()
    } for log in logs])
