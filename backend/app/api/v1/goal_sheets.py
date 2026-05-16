from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import GoalSheet, Goal, CheckIn, Achievement
from app.models.user import User
from app.models.cycle import Cycle
from app.schemas.goal_sheet import GoalSheetOut, ReturnPayload
from app.core.validators import validate_sheet_submission
from app.core.notifications import notify_manager
from app.core.utils import is_window_open
from app.core.audit import write_audit_log

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
        
    if not is_window_open(cycle, "goal_setting"):
        return err("WINDOW_CLOSED", "Goal setting window is closed.", 422)
        
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
    
    out = GoalSheetOut.model_validate(new_sheet)
    out.employee_name = user.full_name
    out.cycle_label = f"{cycle.year} · {cycle.phase}"
    
    return ok(out.model_dump(mode="json"), 201)

@router.get("/mine")
@require_roles("employee", "manager", "admin")
async def get_my_sheets(request: Request, db: AsyncSession = Depends(get_db)):
    """Get all goal sheets for the current user."""
    user = request.state.user
    res = await db.execute(
        select(GoalSheet, Cycle, User)
        .join(Cycle, GoalSheet.cycle_id == Cycle.id)
        .join(User, GoalSheet.employee_id == User.id)
        .where(GoalSheet.employee_id == user.id)
        .order_by(GoalSheet.submitted_at.desc().nullslast())
    )
    results = []
    for sheet, cycle, emp in res.all():
        out = GoalSheetOut.model_validate(sheet)
        out.cycle_label = f"{cycle.year} · {cycle.phase}"
        out.employee_name = emp.full_name
        results.append(out.model_dump(mode="json"))
    return ok(results)

@router.get("/team")
@require_roles("manager", "admin")
async def get_team_sheets(request: Request, db: AsyncSession = Depends(get_db)):
    """Get goal sheets of direct reports."""
    user = request.state.user
    res = await db.execute(
        select(GoalSheet, Cycle, User)
        .join(Cycle, GoalSheet.cycle_id == Cycle.id)
        .join(User, GoalSheet.employee_id == User.id)
        .where(User.manager_id == user.id)
        .order_by(GoalSheet.submitted_at.desc().nullslast())
    )
    results = []
    for sheet, cycle, emp in res.all():
        out = GoalSheetOut.model_validate(sheet)
        out.cycle_label = f"{cycle.year} · {cycle.phase}"
        out.employee_name = emp.full_name
        results.append(out.model_dump(mode="json"))
    return ok(results)

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
        emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
        emp = emp_res.scalar_one()
        if emp.manager_id != user.id:
            return err("FORBIDDEN", "You do not have access to this sheet", 403)
            
    out = GoalSheetOut.model_validate(sheet)
    cycle_res = await db.execute(select(Cycle).where(Cycle.id == sheet.cycle_id))
    cycle = cycle_res.scalar_one()
    out.cycle_label = f"{cycle.year} · {cycle.phase}"
    
    emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
    emp = emp_res.scalar_one()
    out.employee_name = emp.full_name
    
    out = out.model_dump(mode="json")
    
    # Calculate progress score
    res_goals = await db.execute(select(Goal).where(Goal.sheet_id == sheet.id))
    goals = res_goals.scalars().all()
    
    # Batch fetch latest achievements to avoid N+1
    goal_ids = [g.id for g in goals]
    ach_res = await db.execute(
        select(Achievement)
        .where(Achievement.goal_id.in_(goal_ids))
        .order_by(Achievement.goal_id, Achievement.updated_at.desc())
    )
    all_achs = ach_res.scalars().all()
    
    # Map goal_id to its latest achievement
    latest_achs = {}
    for a in all_achs:
        if a.goal_id not in latest_achs:
            latest_achs[a.goal_id] = a

    total_score = 0.0
    for g in goals:
        ach = latest_achs.get(g.id)
        actual = ach.actual if ach else None
        from app.core.utils import compute_progress_score
        score = compute_progress_score(g.uom_type, g.target, actual)
        total_score += (score * g.weightage / 100)
        
    out["progress_score"] = round(total_score, 2)
    return ok(out)

@router.post("/{sheet_id}/submit")
@require_roles("employee", "manager", "admin")
async def submit_sheet(sheet_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user = request.state.user
    
    cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = cycle_res.scalar_one_or_none()
    if not cycle:
        return err("NO_ACTIVE_CYCLE", "There is no active cycle for goal setting.", 400)
    if not is_window_open(cycle, "goal_setting"):
        return err("WINDOW_CLOSED", "Goal setting window is closed.", 422)
        
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
        
    errors = validate_sheet_submission(goals)
    if errors:
        return err("VALIDATION_ERROR", "Submission requirements failed: " + " | ".join(errors), 400)
        
    sheet.status = "submitted"
    sheet.submitted_at = datetime.utcnow()
    
    for goal in goals:
        await write_audit_log(db, goal.id, user.id, "status", "draft", "submitted")
    
    # Notify manager
    from app.models.user import User
    emp_res = await db.execute(select(User).where(User.id == sheet.employee_id))
    emp = emp_res.scalar_one()
    if emp.manager_id:
        await notify_manager(
            manager_id=emp.manager_id,
            event="sheet_submitted",
            payload={"sheet_id": str(sheet.id), "employee_name": emp.full_name}
        )
        
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

    # Optimistic locking check
    if_unmodified_since = request.headers.get("If-Unmodified-Since")
    if if_unmodified_since:
        try:
            from datetime import datetime
            # We compare ISO strings or simple timestamp for hackathon
            if sheet.updated_at.isoformat() != if_unmodified_since:
                return err("CONFLICT", "The sheet has been modified by another user. Please refresh.", 409)
        except Exception:
            pass
            
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
    
    goals_res = await db.execute(select(Goal).where(Goal.sheet_id == sheet.id))
    goals = goals_res.scalars().all()
    for goal in goals:
        await write_audit_log(db, goal.id, user.id, "status", "submitted", "approved")
    
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

    # Optimistic locking check
    if_unmodified_since = request.headers.get("If-Unmodified-Since")
    if if_unmodified_since:
        try:
            if sheet.updated_at.isoformat() != if_unmodified_since:
                return err("CONFLICT", "The sheet has been modified by another user. Please refresh.", 409)
        except Exception:
            pass
            
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
    
    goals_res = await db.execute(select(Goal).where(Goal.sheet_id == sheet.id))
    goals = goals_res.scalars().all()
    for goal in goals:
        await write_audit_log(db, goal.id, user.id, "status", "submitted", "rework")
    
    await db.commit()
    await db.refresh(sheet)
    return ok(GoalSheetOut.model_validate(sheet).model_dump(mode="json"))
