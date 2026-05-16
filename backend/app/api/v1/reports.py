from uuid import UUID
from typing import Optional
import csv
from io import BytesIO, StringIO
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

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
async def get_audit_logs(goal_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
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

@router.get("/achievement")
@require_roles("manager", "admin")
async def get_achievement_report(
    request: Request,
    department_id: Optional[UUID] = None,
    cycle_id: Optional[UUID] = None,
    status: Optional[str] = None,
    format: str = "xlsx",
    db: AsyncSession = Depends(get_db)
):
    user = request.state.user
    
    if not cycle_id:
        cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
        cycle = cycle_res.scalar_one_or_none()
        if cycle:
            cycle_id = cycle.id
            
    query = select(User, Department, GoalSheet, Goal).select_from(User)
    query = query.outerjoin(Department, User.department_id == Department.id)
    query = query.join(GoalSheet, GoalSheet.employee_id == User.id)
    query = query.join(Goal, Goal.sheet_id == GoalSheet.id)
    
    if cycle_id:
        query = query.where(GoalSheet.cycle_id == cycle_id)
        
    if department_id:
        query = query.where(User.department_id == department_id)
        
    if user.role == "manager":
        query = query.where(User.manager_id == user.id)
        
    res = await db.execute(query)
    base_rows = res.all()
    
    goal_ids = [row.Goal.id for row in base_rows]
    
    achievements_by_goal = {}
    if goal_ids:
        ach_res = await db.execute(select(Achievement).where(Achievement.goal_id.in_(goal_ids)))
        all_achs = ach_res.scalars().all()
        for ach in all_achs:
            if ach.goal_id not in achievements_by_goal:
                achievements_by_goal[ach.goal_id] = {}
            achievements_by_goal[ach.goal_id][ach.quarter.lower()] = ach
            
    output_data = []
    headers = [
        "Employee Name", "Employee Email", "Department", "Goal Title", "Thrust Area",
        "UoM Type", "Target", "Q1 Actual", "Q2 Actual", "Q3 Actual", "Q4 Actual",
        "Q1 Status", "Q2 Status", "Q3 Status", "Q4 Status", "Weightage"
    ]
    
    for row in base_rows:
        usr, dept, sheet, goal = row.User, row.Department, row.GoalSheet, row.Goal
        
        if status and sheet.status != status:
            continue
            
        achs = achievements_by_goal.get(goal.id, {})
        
        output_data.append([
            usr.full_name,
            usr.email,
            dept.name if dept else "",
            goal.title,
            goal.thrust_area,
            goal.uom_type,
            goal.target,
            achs.get("q1").actual if achs.get("q1") else "",
            achs.get("q2").actual if achs.get("q2") else "",
            achs.get("q3").actual if achs.get("q3") else "",
            achs.get("q4").actual if achs.get("q4") else "",
            achs.get("q1").status if achs.get("q1") else "",
            achs.get("q2").status if achs.get("q2") else "",
            achs.get("q3").status if achs.get("q3") else "",
            achs.get("q4").status if achs.get("q4") else "",
            goal.weightage
        ])
        
    if format == "csv":
        out = StringIO()
        writer = csv.writer(out)
        writer.writerow(headers)
        writer.writerows(output_data)
        out.seek(0)
        return StreamingResponse(
            iter([out.getvalue()]), 
            media_type="text/csv", 
            headers={"Content-Disposition": 'attachment; filename="achievement_report.csv"'}
        )
    else:
        wb = Workbook()
        ws = wb.active
        ws.append(headers)
        for row_data in output_data:
            ws.append(row_data)
        out = BytesIO()
        wb.save(out)
        out.seek(0)
        return StreamingResponse(
            out, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
            headers={"Content-Disposition": 'attachment; filename="achievement_report.xlsx"'}
        )

@router.get("/completion")
@require_roles("manager", "admin")
async def get_completion_report(
    request: Request,
    cycle_id: Optional[UUID] = None,
    quarter: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    user = request.state.user
    
    if not cycle_id:
        cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
        cycle = cycle_res.scalar_one_or_none()
        if cycle:
            cycle_id = cycle.id
            
    query = select(User)
    if user.role == "manager":
        query = query.where(User.manager_id == user.id)
        
    users_res = await db.execute(query)
    employees = users_res.scalars().all()
    
    manager_ids = list(set(e.manager_id for e in employees if e.manager_id))
    managers = {}
    if manager_ids:
        mgr_res = await db.execute(select(User).where(User.id.in_(manager_ids)))
        for m in mgr_res.scalars().all():
            managers[m.id] = m.full_name
            
    emp_ids = [e.id for e in employees]
    sheets = {}
    if emp_ids and cycle_id:
        sheet_res = await db.execute(select(GoalSheet).where(GoalSheet.employee_id.in_(emp_ids), GoalSheet.cycle_id == cycle_id))
        for s in sheet_res.scalars().all():
            sheets[s.employee_id] = s
            
    sheet_ids = [s.id for s in sheets.values()]
    checkins_by_sheet = {}
    if sheet_ids:
        from app.models.goal import CheckIn
        checkin_query = select(CheckIn).where(CheckIn.sheet_id.in_(sheet_ids))
        if quarter:
            checkin_query = checkin_query.where(CheckIn.quarter == quarter)
        checkin_res = await db.execute(checkin_query)
        for c in checkin_res.scalars().all():
            if c.sheet_id not in checkins_by_sheet:
                checkins_by_sheet[c.sheet_id] = []
            checkins_by_sheet[c.sheet_id].append(c)
            
    results = []
    for emp in employees:
        if emp.role == "admin" or (emp.role == "manager" and user.role == "manager" and emp.id == user.id):
            continue # skip admins and self if manager
            
        sheet = sheets.get(emp.id)
        checkins = checkins_by_sheet.get(sheet.id, []) if sheet else []
        
        last_checkin_at = max((c.created_at for c in checkins), default=None)
        
        checkins_completed = len(checkins)
        checkins_pending = (1 - checkins_completed) if quarter else (4 - checkins_completed)
        if checkins_pending < 0: checkins_pending = 0
        
        results.append({
            "employee_id": str(emp.id),
            "employee_name": emp.full_name,
            "manager_name": managers.get(emp.manager_id),
            "sheet_status": sheet.status if sheet else "none",
            "checkins_completed": checkins_completed,
            "checkins_pending": checkins_pending,
            "last_checkin_at": last_checkin_at.isoformat() if last_checkin_at else None
        })
        
    return ok(results)
