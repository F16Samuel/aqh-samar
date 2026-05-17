from uuid import UUID
from typing import Optional
import csv
import math as pymath
from io import BytesIO, StringIO
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.responses import ok, err
from app.core.security import require_roles
from app.db.session import get_db
from app.models.goal import GoalSheet, Goal, Achievement, AuditLog, CheckIn
from app.models.user import User
from app.models.department import Department
from app.models.cycle import Cycle
from app.core.utils import compute_progress_score

router = APIRouter()

# ── Shared stat helpers ────────────────────────────────────────────────────────
def _mean(vals: list[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0

def _median(vals: list[float]) -> float:
    if not vals: return 0.0
    s = sorted(vals)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2

def _mode(vals: list[float]) -> float:
    if not vals: return 0.0
    freq: dict = {}
    for v in vals:
        k = round(v, 1)
        freq[k] = freq.get(k, 0) + 1
    return max(freq, key=lambda k: freq[k])

def _std_dev(vals: list[float]) -> float:
    if len(vals) < 2: return 0.0
    avg = _mean(vals)
    return pymath.sqrt(sum((v - avg) ** 2 for v in vals) / len(vals))

def _percentile(vals: list[float], p: float) -> float:
    if not vals: return 0.0
    s = sorted(vals)
    idx = (p / 100) * (len(s) - 1)
    lo, hi = int(idx), min(int(idx) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)

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
    
    # Batch fetch latest achievements to avoid N+1
    from app.models.goal import Achievement
    goal_ids = [g.id for g in goals]
    achievements_by_goal = {}
    if goal_ids:
        ach_res = await db.execute(
            select(Achievement)
            .where(Achievement.goal_id.in_(goal_ids))
            .order_by(Achievement.goal_id, Achievement.updated_at.desc())
        )
        all_achs = ach_res.scalars().all()
        # Map goal_id to its latest achievement
        for a in all_achs:
            if a.goal_id not in achievements_by_goal:
                achievements_by_goal[a.goal_id] = a

    sheet_scores = {sid: 0.0 for sid in sheet_ids}
    for g in goals:
        ach = achievements_by_goal.get(g.id)
        actual = ach.actual if ach else None
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
    
    # Batch fetch latest achievements to avoid N+1
    from app.models.goal import Achievement
    goal_ids = [g.id for g in goals]
    achievements_by_goal = {}
    if goal_ids:
        ach_res = await db.execute(
            select(Achievement)
            .where(Achievement.goal_id.in_(goal_ids))
            .order_by(Achievement.goal_id, Achievement.updated_at.desc())
        )
        for a in ach_res.scalars().all():
            if a.goal_id not in achievements_by_goal:
                achievements_by_goal[a.goal_id] = a

    sheet_scores = {sid: 0.0 for sid in sheet_ids}
    for g in goals:
        ach = achievements_by_goal.get(g.id)
        actual = ach.actual if ach else None
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
    target_role: Optional[str] = None,
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
        
    if user.platform_role == "manager":
        # Restrict manager downloads strictly to reportees under them
        query = query.where(User.manager_id == user.id)
        
        # Only allow filtering/accessing departments that their reportees belong to
        dept_ids_res = await db.execute(
            select(User.department_id)
            .where(User.manager_id == user.id)
            .where(User.department_id != None)
        )
        allowed_dept_ids = set(dept_ids_res.scalars().all())
        
        if department_id:
            if department_id in allowed_dept_ids:
                query = query.where(User.department_id == department_id)
            else:
                query = query.where(User.department_id.in_(allowed_dept_ids))
        else:
            query = query.where(User.department_id.in_(allowed_dept_ids))
    else:
        # Admin can view any department they request
        if department_id:
            query = query.where(User.department_id == department_id)
            
    if target_role == "manager":
        query = query.where(User.platform_role == "manager")
    elif target_role == "employee":
        query = query.where(User.platform_role == "employee")
        
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
        "Q1 Score (%)", "Q2 Score (%)", "Q3 Score (%)", "Q4 Score (%)",
        "Q1 Status", "Q2 Status", "Q3 Status", "Q4 Status", "Weightage"
    ]
    
    for row in base_rows:
        usr, dept, sheet, goal = row.User, row.Department, row.GoalSheet, row.Goal
        
        if status and sheet.status != status:
            continue
            
        achs = achievements_by_goal.get(goal.id, {})
        
        def get_score(q):
            ach = achs.get(q)
            if not ach or not ach.actual: return ""
            return round(compute_progress_score(goal.uom_type, goal.target, ach.actual), 1)

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
            get_score("q1"),
            get_score("q2"),
            get_score("q3"),
            get_score("q4"),
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
    if user.platform_role == "manager":
        query = query.where(User.manager_id == user.id)
        
    users_res = await db.execute(query)
    employees = users_res.scalars().all()
    
    # Fetch departments for name mapping
    dept_res = await db.execute(select(Department))
    depts_map = {d.id: d.name for d in dept_res.scalars().all()}

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

    # Cross-reference goals and achievements for completion percentage
    goals_by_sheet = {}
    latest_ach_by_goal = {}
    if sheet_ids:
        goals_res = await db.execute(select(Goal).where(Goal.sheet_id.in_(sheet_ids)))
        all_goals = goals_res.scalars().all()
        for g in all_goals:
            goals_by_sheet.setdefault(g.sheet_id, []).append(g)
            
        goal_ids = [g.id for g in all_goals]
        if goal_ids:
            ach_res = await db.execute(
                select(Achievement)
                .where(Achievement.goal_id.in_(goal_ids))
                .order_by(Achievement.goal_id, Achievement.updated_at.desc())
            )
            for ach in ach_res.scalars().all():
                if ach.goal_id not in latest_ach_by_goal:
                    latest_ach_by_goal[ach.goal_id] = ach
            
    results = []
    for emp in employees:
        if emp.platform_role == "admin" or (emp.platform_role == "manager" and user.platform_role == "manager" and emp.id == user.id):
            continue # skip admins and self if manager
            
        sheet = sheets.get(emp.id)
        checkins = checkins_by_sheet.get(sheet.id, []) if sheet else []
        
        last_checkin_at = max((c.created_at for c in checkins), default=None)
        
        checkins_completed = len(checkins)
        checkins_pending = (1 - checkins_completed) if quarter else (4 - checkins_completed)
        if checkins_pending < 0: checkins_pending = 0

        # Calculate progress completion percentage
        progress_score = 0.0
        if sheet:
            goals = goals_by_sheet.get(sheet.id, [])
            for g in goals:
                ach = latest_ach_by_goal.get(g.id)
                actual = ach.actual if ach else None
                score = compute_progress_score(g.uom_type, g.target, actual)
                progress_score += score * g.weightage / 100
        
        results.append({
            "employee_id": str(emp.id),
            "employee_name": emp.full_name,
            "department_id": str(emp.department_id) if emp.department_id else None,
            "department_name": depts_map.get(emp.department_id) if emp.department_id else None,
            "manager_id": str(emp.manager_id) if emp.manager_id else None,
            "manager_name": managers.get(emp.manager_id),
            "sheet_status": sheet.status if sheet else "none",
            "checkins_completed": checkins_completed,
            "checkins_pending": checkins_pending,
            "last_checkin_at": last_checkin_at.isoformat() if last_checkin_at else None,
            "progress_score": round(progress_score, 1)
        })
        
    return ok(results)


@router.get("/manager-analytics")
@require_roles("admin")
async def manager_analytics(request: Request, cycle_id: Optional[UUID] = None, db: AsyncSession = Depends(get_db)):
    """
    Admin-only: Deep hierarchical analytics for every manager.
    Returns per-manager statistics including mean/median/mode/std-dev of employee
    achievement scores, bias index, thrust-area distribution, funnel data and quarterly trends.
    """
    # Resolve cycle
    if not cycle_id:
        cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
        cycle = cycle_res.scalar_one_or_none()
        if not cycle:
            return err("NO_ACTIVE_CYCLE", "No active cycle found", 400)
        cycle_id = cycle.id
    else:
        cycle_res = await db.execute(select(Cycle).where(Cycle.id == cycle_id))
        cycle = cycle_res.scalar_one_or_none()
        if not cycle:
            return err("NOT_FOUND", "Cycle not found", 404)

    # Load all employees + their managers
    emp_res = await db.execute(select(User).where(User.manager_id != None))
    employees = emp_res.scalars().all()
    manager_ids = list(set(e.manager_id for e in employees))
    mgr_res = await db.execute(select(User).where(User.id.in_(manager_ids)))
    managers_map = {m.id: m for m in mgr_res.scalars().all()}

    # Load all sheets for this cycle
    sheet_res = await db.execute(select(GoalSheet).where(GoalSheet.cycle_id == cycle_id))
    all_sheets = sheet_res.scalars().all()
    sheets_by_emp = {s.employee_id: s for s in all_sheets}

    # Load all goals
    sheet_ids = [s.id for s in all_sheets]
    goals_res = await db.execute(select(Goal).where(Goal.sheet_id.in_(sheet_ids)))
    all_goals = goals_res.scalars().all()
    goals_by_sheet: dict = {}
    for g in all_goals:
        goals_by_sheet.setdefault(g.sheet_id, []).append(g)

    # Load all achievements
    goal_ids = [g.id for g in all_goals]
    ach_res = await db.execute(
        select(Achievement)
        .where(Achievement.goal_id.in_(goal_ids))
        .order_by(Achievement.goal_id, Achievement.updated_at.desc())
    )
    all_achs = ach_res.scalars().all()
    latest_ach_by_goal: dict = {}
    all_achs_by_goal: dict = {}
    for a in all_achs:
        if a.goal_id not in latest_ach_by_goal:
            latest_ach_by_goal[a.goal_id] = a
        all_achs_by_goal.setdefault(a.goal_id, []).append(a)

    # Load all checkins
    checkin_res = await db.execute(select(CheckIn).where(CheckIn.sheet_id.in_(sheet_ids)))
    all_checkins = checkin_res.scalars().all()
    checkins_by_sheet: dict = {}
    for c in all_checkins:
        checkins_by_sheet.setdefault(c.sheet_id, []).append(c)

    # Group employees by manager and compute analytics
    manager_groups: dict = {}
    for emp in employees:
        manager_groups.setdefault(emp.manager_id, []).append(emp)

    result = []
    for mgr_id, team in manager_groups.items():
        mgr = managers_map.get(mgr_id)
        if not mgr:
            continue

        emp_scores: list[float] = []
        emp_goal_counts: list[int] = []
        emp_ach_counts: list[int] = []
        thrust_area_counts: dict = {}
        quarterly_scores: dict = {"Q1": [], "Q2": [], "Q3": [], "Q4": []}
        funnel = {"draft": 0, "submitted": 0, "approved": 0, "rework": 0, "none": 0}
        top_performers: list[dict] = []
        at_risk: list[dict] = []

        for emp in team:
            sheet = sheets_by_emp.get(emp.id)
            # Funnel tracking
            status = sheet.status if sheet else "none"
            funnel[status] = funnel.get(status, 0) + 1

            if not sheet:
                continue

            goals = goals_by_sheet.get(sheet.id, [])
            emp_goal_counts.append(len(goals))

            # Compute weighted score for employee
            total_score = 0.0
            total_ach = 0
            for g in goals:
                # Thrust area breakdown
                thrust_area_counts[g.thrust_area] = thrust_area_counts.get(g.thrust_area, 0) + 1

                ach = latest_ach_by_goal.get(g.id)
                actual = ach.actual if ach else None
                score = compute_progress_score(g.uom_type, g.target, actual)
                total_score += score * g.weightage / 100

                # Per-quarter tracking
                for a in all_achs_by_goal.get(g.id, []):
                    q_key = a.quarter.upper()
                    if q_key in quarterly_scores:
                        s = compute_progress_score(g.uom_type, g.target, a.actual)
                        quarterly_scores[q_key].append(s)
                    total_ach += 1

            emp_ach_counts.append(total_ach)
            emp_scores.append(round(total_score, 2))

            emp_summary = {
                "employee_id": str(emp.id),
                "employee_name": emp.full_name,
                "score": round(total_score, 2),
                "goal_count": len(goals),
                "ach_count": total_ach
            }
            if total_score >= 90:
                top_performers.append(emp_summary)
            elif total_score < 50 and len(goals) > 0:
                at_risk.append(emp_summary)

        # Statistical calculations
        stats = {
            "mean": round(_mean(emp_scores), 2),
            "median": round(_median(emp_scores), 2),
            "mode": round(_mode(emp_scores), 2) if emp_scores else 0,
            "std_dev": round(_std_dev(emp_scores), 2),
            "p25": round(_percentile(emp_scores, 25), 2),
            "p75": round(_percentile(emp_scores, 75), 2),
            "min": round(min(emp_scores), 2) if emp_scores else 0,
            "max": round(max(emp_scores), 2) if emp_scores else 0,
        }

        # Bias index: if manager approved early (sheet=approved) vs employee scores
        approved_count = sum(1 for emp in team if sheets_by_emp.get(emp.id) and sheets_by_emp[emp.id].status == "approved")
        approval_rate = round(approved_count / len(team) * 100, 1) if team else 0
        avg_score = _mean(emp_scores)
        # Bias: high approval rate + low scores = lenient bias; low approval + high scores = strict
        bias_index = round(approval_rate - avg_score, 2)

        result.append({
            "manager_id": str(mgr_id),
            "manager_name": mgr.full_name,
            "team_size": len(team),
            "stats": stats,
            "bias_index": bias_index,
            "bias_label": "Lenient" if bias_index > 15 else ("Strict" if bias_index < -15 else "Balanced"),
            "approval_rate": approval_rate,
            "avg_goals_per_employee": round(_mean(emp_goal_counts), 2),
            "avg_achievements_per_employee": round(_mean(emp_ach_counts), 2),
            "thrust_area_distribution": thrust_area_counts,
            "quarterly_avg_scores": {
                q: round(_mean(scores), 2) for q, scores in quarterly_scores.items()
            },
            "funnel": funnel,
            "top_performers": top_performers,
            "at_risk": at_risk,
            "employee_scores": sorted(
                [{"name": team[i].full_name if i < len(team) else "", "score": s}
                 for i, s in enumerate(emp_scores)],
                key=lambda x: x["score"], reverse=True
            ),
        })

    # Company-wide stats across all managers
    all_manager_avg_scores = [r["stats"]["mean"] for r in result]
    company_stats = {
        "mean": round(_mean(all_manager_avg_scores), 2),
        "median": round(_median(all_manager_avg_scores), 2),
        "std_dev": round(_std_dev(all_manager_avg_scores), 2),
        "total_managers": len(result),
        "cycle_label": f"{cycle.year} · {cycle.phase}",
    }

    return ok({"company": company_stats, "managers": result})


@router.get("/team-analytics")
@require_roles("manager", "admin")
async def team_analytics(request: Request, cycle_id: Optional[UUID] = None, db: AsyncSession = Depends(get_db)):
    """
    Manager-facing: Detailed per-employee breakdown showing goal progress, achievement
    pulse, check-in frequency, quarterly scores, thrust-area balance, and variance.
    """
    user = request.state.user

    # Resolve cycle
    if not cycle_id:
        cycle_res = await db.execute(select(Cycle).where(Cycle.is_active == True))
        cycle = cycle_res.scalar_one_or_none()
        if not cycle:
            return err("NO_ACTIVE_CYCLE", "No active cycle found", 400)
        cycle_id = cycle.id

    # Load direct reports
    query = select(User)
    if user.platform_role == "manager":
        query = query.where(User.manager_id == user.id)
    emp_res = await db.execute(query)
    employees = [e for e in emp_res.scalars().all() if e.platform_role not in ("admin",) and e.id != user.id]

    # Load sheets
    emp_ids = [e.id for e in employees]
    sheet_res = await db.execute(
        select(GoalSheet).where(GoalSheet.employee_id.in_(emp_ids), GoalSheet.cycle_id == cycle_id)
    )
    sheets_by_emp = {s.employee_id: s for s in sheet_res.scalars().all()}

    # Load goals
    sheet_ids = [s.id for s in sheets_by_emp.values()]
    goals_res = await db.execute(select(Goal).where(Goal.sheet_id.in_(sheet_ids)))
    all_goals = goals_res.scalars().all()
    goals_by_sheet: dict = {}
    for g in all_goals:
        goals_by_sheet.setdefault(g.sheet_id, []).append(g)

    # Load all achievements
    goal_ids = [g.id for g in all_goals]
    ach_res = await db.execute(select(Achievement).where(Achievement.goal_id.in_(goal_ids)))
    all_achs = ach_res.scalars().all()
    latest_ach_by_goal: dict = {}
    all_achs_by_goal: dict = {}
    for a in sorted(all_achs, key=lambda x: x.updated_at or x.goal_id, reverse=True):
        if a.goal_id not in latest_ach_by_goal:
            latest_ach_by_goal[a.goal_id] = a
        all_achs_by_goal.setdefault(a.goal_id, []).append(a)

    # Load checkins
    checkin_res = await db.execute(select(CheckIn).where(CheckIn.sheet_id.in_(sheet_ids)))
    checkins_by_sheet: dict = {}
    for c in checkin_res.scalars().all():
        checkins_by_sheet.setdefault(c.sheet_id, []).append(c)

    result = []
    for emp in employees:
        sheet = sheets_by_emp.get(emp.id)
        goals = goals_by_sheet.get(sheet.id, []) if sheet else []
        checkins = checkins_by_sheet.get(sheet.id, []) if sheet else []

        thrust_scores: dict = {}
        quarterly_scores: dict = {"Q1": 0.0, "Q2": 0.0, "Q3": 0.0, "Q4": 0.0}
        quarterly_counts: dict = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
        total_score = 0.0
        goal_details = []

        for g in goals:
            ach = latest_ach_by_goal.get(g.id)
            actual = ach.actual if ach else None
            score = compute_progress_score(g.uom_type, g.target, actual)
            weighted = score * g.weightage / 100
            total_score += weighted

            # Thrust area aggregation
            if g.thrust_area not in thrust_scores:
                thrust_scores[g.thrust_area] = {"total": 0.0, "count": 0}
            thrust_scores[g.thrust_area]["total"] += score
            thrust_scores[g.thrust_area]["count"] += 1

            # Per-quarter
            q_achs = all_achs_by_goal.get(g.id, [])
            q_by_quarter: dict = {}
            for a in q_achs:
                q_key = a.quarter.upper()
                if q_key in quarterly_scores and q_key not in q_by_quarter:
                    s = compute_progress_score(g.uom_type, g.target, a.actual)
                    quarterly_scores[q_key] += s * g.weightage / 100
                    quarterly_counts[q_key] += 1
                    q_by_quarter[q_key] = s

            # Variance: target vs actual
            target_val = None
            actual_val = None
            try:
                if g.uom_type in ("min", "max", "zero"):
                    target_val = float(g.target)
                    actual_val = float(actual) if actual else None
            except (ValueError, TypeError):
                pass

            goal_details.append({
                "goal_id": str(g.id),
                "title": g.title,
                "thrust_area": g.thrust_area,
                "uom_type": g.uom_type,
                "target": g.target,
                "actual": actual,
                "weightage": g.weightage,
                "score": round(score, 2),
                "weighted_score": round(weighted, 2),
                "is_locked": g.is_locked,
                "is_shared": g.shared_from is not None,
                "target_val": target_val,
                "actual_val": actual_val,
                "variance": round(actual_val - target_val, 2) if target_val is not None and actual_val is not None else None,
                "quarterly_breakdown": q_by_quarter,
                "ach_count": len(q_achs),
            })

        # Check-in frequency analysis
        checkin_quarters = [c.quarter for c in checkins]
        checkin_freq = {q: checkin_quarters.count(q) for q in set(checkin_quarters)}
        latest_checkin = max((c.created_at for c in checkins), default=None)

        result.append({
            "employee_id": str(emp.id),
            "employee_name": emp.full_name,
            "email": emp.email,
            "job_title": emp.job_title,
            "platform_role": emp.platform_role,
            "sheet_status": sheet.status if sheet else "none",
            "total_score": round(total_score, 2),
            "goal_count": len(goals),
            "goals": goal_details,
            "thrust_area_balance": {
                k: round(v["total"] / v["count"], 2) for k, v in thrust_scores.items()
            },
            "quarterly_scores": {
                q: round(quarterly_scores[q], 2) for q in quarterly_scores
            },
            "checkins_completed": len(checkins),
            "checkin_frequency": checkin_freq,
            "last_checkin_at": latest_checkin.isoformat() if latest_checkin else None,
            "on_track": total_score >= 75,
            "at_risk": 0 < total_score < 50,
        })

    # Team-level aggregates
    all_scores = [r["total_score"] for r in result]
    return ok({
        "team_summary": {
            "mean_score": round(_mean(all_scores), 2),
            "median_score": round(_median(all_scores), 2),
            "std_dev": round(_std_dev(all_scores), 2),
            "on_track_count": sum(1 for r in result if r["on_track"]),
            "at_risk_count": sum(1 for r in result if r["at_risk"]),
            "total_employees": len(result),
        },
        "employees": result,
    })
