from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import Goal, GoalSheet
from app.core.audit import write_audit_log
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/unlock/{goal_id}")
@require_roles("admin")
async def unlock_goal(goal_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Admin overrides lock and writes audit entry."""
    user = request.state.user
    
    res = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = res.scalar_one_or_none()
    
    if not goal:
        return err("NOT_FOUND", "Goal not found", 404)
        
    if not goal.is_locked:
        return err("ALREADY_UNLOCKED", "Goal is already unlocked", 400)
        
    goal.is_locked = False
    
    await write_audit_log(
        session=db,
        goal_id=goal.id,
        changed_by=user.id,
        field_name="is_locked",
        old_value="True",
        new_value="False"
    )
    
    return ok({"message": "Goal unlocked successfully", "goal_id": str(goal.id)})

@router.get("/escalations")
@require_roles("admin")
async def get_escalations(db: AsyncSession = Depends(get_db)):
    """Returns sheets stuck in 'submitted' > 7 days."""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    res = await db.execute(
        select(GoalSheet).where(
            GoalSheet.status == "submitted",
            GoalSheet.submitted_at < seven_days_ago
        )
    )
    sheets = res.scalars().all()
    return ok([
        {
            "id": str(s.id),
            "employee_id": str(s.employee_id),
            "status": s.status,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None
        }
        for s in sheets
    ])
