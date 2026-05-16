from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import Goal, AuditLog

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
    
    # Write audit log
    audit = AuditLog(
        goal_id=goal.id,
        changed_by=user.id,
        field_name="is_locked",
        old_value="True",
        new_value="False"
    )
    db.add(audit)
    
    await db.commit()
    return ok({"message": "Goal unlocked successfully", "goal_id": str(goal.id)})
