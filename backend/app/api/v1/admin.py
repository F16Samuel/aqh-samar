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
    """
    List all open escalations. 
    Sheets stalled in 'submitted' status for > 7 days are auto-calculated or fetched from DB.
    """
    from app.models.goal import Escalation, GoalSheet
    from app.models.user import User
    from datetime import datetime, timedelta
    
    # 1. Manual/Calculated Escalations (Stalled Sheets)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    stalled_res = await db.execute(
        select(GoalSheet)
        .where(GoalSheet.status == "submitted", GoalSheet.submitted_at <= seven_days_ago)
    )
    stalled_sheets = stalled_res.scalars().all()
    
    # 2. Formal Escalation Records from DB
    esc_res = await db.execute(
        select(Escalation, GoalSheet, User)
        .join(GoalSheet, Escalation.sheet_id == GoalSheet.id)
        .join(User, Escalation.escalated_to == User.id)
        .where(Escalation.status == "open")
    )
    formal_escalations = esc_res.all()
    
    results = []
    # Add stalled sheets as "Auto-Escalated"
    seen_sheet_ids = set()
    for s in stalled_sheets:
        seen_sheet_ids.add(s.id)
        results.append({
            "id": str(s.id),
            "sheet_id": str(s.id),
            "employee_id": str(s.employee_id),
            "submitted_at": s.submitted_at.isoformat(),
            "reason": "Stalled in review for > 7 days",
            "type": "automatic",
            "status": "open"
        })
        
    for esc, sheet, user in formal_escalations:
        if sheet.id in seen_sheet_ids: continue
        results.append({
            "id": str(esc.id),
            "sheet_id": str(sheet.id),
            "employee_id": str(sheet.employee_id),
            "submitted_at": sheet.submitted_at.isoformat() if sheet.submitted_at else None,
            "reason": esc.reason,
            "type": "formal",
            "status": esc.status,
            "escalated_to_name": user.full_name
        })
        
    return ok(results)

@router.post("/escalations/{escalation_id}/resolve")
@require_roles("admin")
async def resolve_escalation(escalation_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    """Mark a formal escalation as resolved."""
    from app.models.goal import Escalation
    res = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    esc = res.scalar_one_or_none()
    
    if not esc:
        return err("NOT_FOUND", "Escalation record not found", 404)
        
    from datetime import datetime
    esc.status = "resolved"
    esc.resolved_at = datetime.utcnow()
    await db.commit()
    return ok({"message": "Escalation resolved"})

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
