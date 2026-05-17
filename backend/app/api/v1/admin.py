from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import Goal, GoalSheet, AuditLog
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
async def get_escalations(request: Request, db: AsyncSession = Depends(get_db)):
    """Returns sheets stuck in 'submitted' > 7 days."""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    from app.models.user import User
    from app.models.cycle import Cycle
    res = await db.execute(
        select(GoalSheet, User, Cycle)
        .join(User, GoalSheet.employee_id == User.id)
        .join(Cycle, GoalSheet.cycle_id == Cycle.id)
        .where(
            GoalSheet.status == "submitted",
            GoalSheet.submitted_at < seven_days_ago
        )
    )
    rows = res.all()
    return ok([
        {
            "id": str(s.id),
            "employee_id": str(s.employee_id),
            "employee_name": u.full_name,
            "cycle_label": f"{c.year} · {c.phase}",
            "status": s.status,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None
        }
        for s, u, c in rows
    ])

@router.get("/audit-logs")
@require_roles("admin")
async def get_audit_logs(request: Request, db: AsyncSession = Depends(get_db)):
    """Admin: view system audit logs (last 100)."""
    from app.models.user import User
    from app.models.goal import Goal
    
    res = await db.execute(
        select(AuditLog, Goal, User)
        .join(Goal, AuditLog.goal_id == Goal.id)
        .join(User, AuditLog.changed_by == User.id)
        .order_by(AuditLog.changed_at.desc())
        .limit(100)
    )
    rows = res.all()
    
    return ok([
        {
            "id": str(log.id),
            "goal_id": str(log.goal_id),
            "goal_title": g.title,
            "changed_by": str(log.changed_by),
            "changed_by_name": u.full_name,
            "field_name": log.field_name.replace("_", " ").title(),
            "old_value": log.old_value,
            "new_value": log.new_value,
            "changed_at": log.changed_at.isoformat()
        }
        for log, g, u in rows
    ])
