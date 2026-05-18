import json
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy import select, delete, text, func
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models.automation import AutomationRule, EscalationTask, EscalationHistory, MockNotification
from app.models.user import User
from app.models.goal import GoalSheet, Goal, Achievement, CheckIn
from app.models.cycle import Cycle
from app.core.automation_engine import run_simulation_dryrun, calculate_sheet_progress, calculate_quarterly_score
from app.core.utils import compute_progress_score
from app.core.security import require_roles

router = APIRouter()

# =============================================================================
# Automation Rules CRUD Endpoints
# =============================================================================

@router.get("/rules", response_model=None)
@require_roles("admin")
async def list_rules(request: Request):
    """
    Fetch all SLA escalation and automation rules
    """
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(AutomationRule).order_by(AutomationRule.created_at.desc()))
        rules = res.scalars().all()
        return [
            {
                "id": str(r.id),
                "name": r.name,
                "description": r.description,
                "trigger_type": r.trigger_type,
                "conditions": r.conditions,
                "actions": r.actions,
                "is_active": r.is_active,
                "created_at": r.created_at.isoformat()
            } for r in rules
        ]


@router.post("/rules", response_model=None)
@require_roles("admin")
async def create_rule(request: Request, data: dict):
    """
    Add a new custom automation rule
    """
    async with AsyncSessionLocal() as session:
        rule = AutomationRule(
            name=data["name"],
            description=data.get("description"),
            trigger_type=data["trigger_type"],
            conditions=data.get("conditions", {}),
            actions=data.get("actions", []),
            is_active=data.get("is_active", True)
        )
        session.add(rule)
        await session.commit()
        return {"id": str(rule.id), "message": "Rule created successfully!"}


@router.put("/rules/{rule_id}", response_model=None)
@require_roles("admin")
async def update_rule(rule_id: UUID, request: Request, data: dict):
    """
    Update an existing automation rule configuration
    """
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(AutomationRule).filter(AutomationRule.id == rule_id))
        rule = res.scalar_one_or_none()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found.")
            
        rule.name = data.get("name", rule.name)
        rule.description = data.get("description", rule.description)
        rule.trigger_type = data.get("trigger_type", rule.trigger_type)
        rule.conditions = data.get("conditions", rule.conditions)
        rule.actions = data.get("actions", rule.actions)
        rule.is_active = data.get("is_active", rule.is_active)
        
        await session.commit()
        return {"message": "Rule updated successfully!"}


@router.delete("/rules/{rule_id}", response_model=None)
@require_roles("admin")
async def delete_rule(rule_id: UUID, request: Request):
    """
    Remove an automation rule
    """
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(AutomationRule).filter(AutomationRule.id == rule_id))
        rule = res.scalar_one_or_none()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found.")
            
        await session.delete(rule)
        await session.commit()
        return {"message": "Rule deleted successfully!"}


# =============================================================================
# Dry-run Simulator
# =============================================================================

@router.post("/simulate", response_model=None)
@require_roles("admin")
async def simulate_rule(request: Request, data: dict):
    """
    Dry-run simulation mode evaluates rule parameters immediately and displays
    affected employees and timeline schedules without modifying the database.
    """
    logs = await run_simulation_dryrun(data)
    return logs


# =============================================================================
# Dashboard SLA Analytics & Risk Metrics
# =============================================================================

@router.get("/analytics", response_model=None)
@require_roles("admin")
async def fetch_sla_analytics(request: Request):
    """
    High-fidelity analytics computed dynamically:
    - Compliance Index: Rate of employee submissions on time.
    - Manager Responsiveness Score: Time taken to approve sheets.
    - Escalation Heatmap: SLA breaches grouped by department.
    - Risk Scoring Matrix: Composite operational risk levels (0-100) per employee.
    """
    async with AsyncSessionLocal() as session:
        # Load active cycle
        res_cycle = await session.execute(select(Cycle).filter(Cycle.is_active == True))
        active_cycle = res_cycle.scalar_one_or_none()
        if not active_cycle:
            return {"error": "No active cycle configured."}

        # 1. Manager Responsiveness Score
        # Checks average hours between sheet submissions and manager approvals
        res_sheets = await session.execute(
            select(GoalSheet)
            .filter(GoalSheet.cycle_id == active_cycle.id, GoalSheet.status.in_(["approved", "locked"]))
            .options(selectinload(GoalSheet.employee).selectinload(User.manager))
        )
        approved_sheets = res_sheets.scalars().all()
        
        manager_stats = {}
        for sh in approved_sheets:
            if not sh.employee or not sh.employee.manager:
                continue
            mgr = sh.employee.manager
            if sh.submitted_at and sh.approved_at:
                delta = (sh.approved_at - sh.submitted_at).total_seconds() / 3600.0
                if mgr.id not in manager_stats:
                    manager_stats[mgr.id] = {"name": mgr.full_name, "total_hours": 0.0, "count": 0}
                manager_stats[mgr.id]["total_hours"] += delta
                manager_stats[mgr.id]["count"] += 1
                
        responsiveness_rankings = []
        for mid, stats in manager_stats.items():
            avg_hours = stats["total_hours"] / stats["count"]
            # Score formula: 100 for <24h, sliding down to 30 for >14 days
            if avg_hours <= 24: score = 100.0
            elif avg_hours <= 72: score = 90.0
            elif avg_hours <= 168: score = 75.0
            elif avg_hours <= 336: score = 50.0
            else: score = 30.0
            
            responsiveness_rankings.append({
                "manager_name": stats["name"],
                "avg_hours": round(avg_hours, 1),
                "responsiveness_score": score,
                "total_reviews": stats["count"]
            })

        # 2. Compliance Index & Risk Scoring Engine
        # Active employees under active cycle
        res_emps = await session.execute(
            select(User)
            .filter(User.role == "employee", User.is_active == True)
            .options(selectinload(User.manager), selectinload(User.department))
        )
        employees = res_emps.scalars().all()
        
        risk_matrix = []
        dept_escalations = {}  # Heatmap helper
        
        for emp in employees:
            dept_name = emp.department.name if emp.department else "General"
            
            # Fetch active goal sheet
            res_sh = await session.execute(
                select(GoalSheet)
                .filter(GoalSheet.employee_id == emp.id, GoalSheet.cycle_id == active_cycle.id)
                .options(selectinload(GoalSheet.goals).selectinload(Goal.achievements))
            )
            sheet = res_sh.scalar_one_or_none()
            
            # Submission Compliance: Approved/Locked = 100%, Draft Overdue = 0%
            has_submitted = sheet and sheet.status in ["submitted", "approved", "locked"]
            submission_comp = 100.0 if has_submitted else 0.0
            
            # Average Quarterly progress score (Current Quarter is Q2)
            completion_rate = 0.0
            if sheet and sheet.goals:
                completion_rate = await calculate_sheet_progress(session, sheet)
                
            # Check quarterly manager comment checkins
            res_chk = await session.execute(
                select(CheckIn).filter(CheckIn.sheet_id == (sheet.id if sheet else None), CheckIn.quarter == "Q2")
            )
            has_checkin = res_chk.scalar_one_or_none() is not None
            
            # Active Overdue SLA Escalation Tasks count
            res_tasks = await session.execute(
                select(EscalationTask)
                .filter(EscalationTask.employee_id == emp.id, EscalationTask.status == "running")
            )
            running_tasks = len(res_tasks.scalars().all())
            
            # Core Risk Score Formula (0-100)
            risk_score = 0.0
            if running_tasks > 0:
                risk_score += 30.0  # Active SLA breach triggers +30 risk
            if completion_rate < 50.0 and sheet:
                risk_score += 20.0  # Stalled low completion +20 risk
            if not has_submitted:
                risk_score += 20.0  # Draft completely unsubmitted +20 risk
            if not has_checkin and has_submitted:
                risk_score += 15.0  # Missing manager checkin +15 risk
                
            # Manager responsiveness check
            mgr_score = 90.0
            if emp.manager_id:
                mgr_stat = next((rank for rank in responsiveness_rankings if rank["manager_name"] == (emp.manager.full_name if emp.manager else "")), None)
                if mgr_stat:
                    mgr_score = mgr_stat["responsiveness_score"]
            if mgr_score < 70.0:
                risk_score += 15.0  # Higher risk due to disengaged manager
                
            risk_score = min(risk_score, 100.0)
            risk_level = "High" if risk_score >= 60 else ("Medium" if risk_score >= 30 else "Low")
            
            compliance_index = (submission_comp + (completion_rate if sheet else 0.0)) / 2.0
            
            risk_matrix.append({
                "employee_name": emp.full_name,
                "employee_email": emp.email,
                "department": dept_name,
                "manager_name": emp.manager.full_name if emp.manager else "HR Admin",
                "compliance_score": round(compliance_index, 1),
                "risk_score": round(risk_score, 1),
                "risk_level": risk_level,
                "active_breaches": running_tasks
            })
            
            # Group SLA escalations for Heatmap
            if running_tasks > 0:
                dept_escalations[dept_name] = dept_escalations.get(dept_name, 0) + running_tasks

        # Escalation Heatmap format
        heatmap = [{"department": k, "escalations": v} for k, v in dept_escalations.items()]
        # Backfill standard departments with 0 if not present in breaches
        for dept in ["Engineering", "Product", "Customer Success", "Security", "Operations", "Finance"]:
            if dept not in dept_escalations:
                heatmap.append({"department": dept, "escalations": 0})

        return {
            "responsiveness_rankings": responsiveness_rankings,
            "risk_matrix": risk_matrix,
            "heatmap": heatmap,
            "summary": {
                "total_escalations": sum(dept_escalations.values()),
                "sla_breach_rate": round((sum(1 for r in risk_matrix if r["active_breaches"] > 0) / len(risk_matrix)) * 100, 1) if risk_matrix else 0.0,
                "avg_compliance": round(sum(r["compliance_score"] for r in risk_matrix) / len(risk_matrix), 1) if risk_matrix else 0.0
            }
        }


# =============================================================================
# Execution History & Tasks list
# =============================================================================

@router.get("/history", response_model=None)
@require_roles("admin")
async def list_escalation_history(request: Request):
    """
    Chronological audit log trace of SLA notifications and reassignments
    """
    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(EscalationHistory)
            .options(selectinload(EscalationHistory.recipient), selectinload(EscalationHistory.rule))
            .order_by(EscalationHistory.executed_at.desc())
        )
        history = res.scalars().all()
        return [
            {
                "id": str(h.id),
                "rule_name": h.rule.name,
                "action_type": h.action_type,
                "recipient_name": h.recipient.full_name if h.recipient else "HR General",
                "recipient_email": h.recipient.email if h.recipient else "hr@company.com",
                "status": h.status,
                "details": h.details,
                "executed_at": h.executed_at.isoformat()
            } for h in history
        ]


@router.get("/tasks", response_model=None)
@require_roles("admin")
async def list_active_tasks(request: Request):
    """
    Lists currently active running escalation timelines
    """
    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(EscalationTask)
            .options(selectinload(EscalationTask.rule), selectinload(EscalationTask.employee))
            .filter(EscalationTask.status == "running")
            .order_by(EscalationTask.next_run_at.asc())
        )
        tasks = res.scalars().all()
        return [
            {
                "id": str(t.id),
                "rule_name": t.rule.name,
                "employee_name": t.employee.full_name,
                "current_step": t.current_step_index,
                "status": t.status,
                "next_run_at": t.next_run_at.isoformat(),
                "sla_deadline": t.sla_deadline.isoformat() if t.sla_deadline else None
            } for t in tasks
        ]


# =============================================================================
# Interactive SSO & Mock Notification Hub Endpoints
# =============================================================================

@router.get("/notifications", response_model=None)
@require_roles("employee", "manager", "admin")
async def fetch_mock_notifications(request: Request, recipient_email: Optional[str] = Query(None)):
    """
    Returns Outlook Emails and Teams Adaptive Cards for the specific authenticated user (sent by or sent to them).
    Admins may pass recipient_email to simulate another user's inbox.
    Non-admins are always scoped to their own email, regardless of the query param.
    """
    caller = request.state.user
    # Security: non-admins can only view their own notifications
    if caller.platform_role != "admin":
        recipient_email = caller.email

    async with AsyncSessionLocal() as session:
        query = select(MockNotification).options(
            selectinload(MockNotification.recipient),
            selectinload(MockNotification.sender)
        )

        if recipient_email:
            res_usr = await session.execute(select(User).filter(User.email == recipient_email))
            scoped_user = res_usr.scalar_one_or_none()
            if scoped_user:
                # Filter notifications where user is recipient OR user is sender
                query = query.filter(
                    (MockNotification.recipient_id == scoped_user.id) |
                    (MockNotification.sender_id == scoped_user.id)
                )

        res = await session.execute(query.order_by(MockNotification.created_at.desc()))
        notifs = res.scalars().all()

        return [
            {
                "id": str(n.id),
                "type": n.type,
                "sender_name": n.sender_name,
                "recipient_name": n.recipient.full_name if n.recipient else "System Automator",
                "recipient_email": n.recipient.email if n.recipient else "",
                "sender_email": n.sender.email if n.sender else "automations@company.com",
                "subject": n.subject,
                "body": n.body,
                "status": n.status,
                "folder": n.folder,
                "interactive_payload": n.interactive_payload,
                "created_at": n.created_at.isoformat()
            } for n in notifs
        ]


@router.post("/notifications/{notif_id}/read", response_model=None)
@require_roles("employee", "manager", "admin")
async def mark_notification_read(notif_id: UUID, request: Request):
    """
    Dismiss or mark notification read in mock hub workspace
    """
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(MockNotification).filter(MockNotification.id == notif_id))
        notif = res.scalar_one_or_none()
        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found.")
            
        notif.status = "read"
        await session.commit()
        return {"message": "Notification updated."}


@router.post("/notifications/compose", response_model=None)
@require_roles("employee", "manager", "admin")
async def compose_mock_notification(request: Request, data: dict):
    """
    Allows composing and sending a custom email or Teams adaptive card to another user.
    The sender is always the authenticated user — the sender_email field in the body is
    accepted for UI convenience but overridden with the caller's verified identity.
    """
    caller = request.state.user
    # Security: sender is always the authenticated caller, not the body-supplied email
    recipient_email = data.get("recipient_email")
    subject = data.get("subject")
    body = data.get("body")
    notif_type = data.get("type", "email")  # email, teams

    if not recipient_email or not body:
        raise HTTPException(status_code=400, detail="Missing recipient or body fields.")

    async with AsyncSessionLocal() as session:
        # Sender is the authenticated user — resolved from JWT, not body
        res_sender = await session.execute(select(User).filter(User.id == caller.id))
        sender = res_sender.scalar_one_or_none()
        if not sender:
            raise HTTPException(status_code=404, detail="Authenticated sender not found.")

        # Find recipient
        res_rec = await session.execute(select(User).filter(User.email == recipient_email))
        recipient = res_rec.scalar_one_or_none()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found.")

        # Create notification
        notif = MockNotification(
            type=notif_type,
            recipient_id=recipient.id,
            sender_id=sender.id,
            sender_name=sender.full_name,
            subject=subject if notif_type == "email" else None,
            body=body,
            status="unread",
            folder="inbox"  # Lands in target recipient's inbox
        )
        session.add(notif)
        await session.commit()
        return {"message": "Notification dispatched successfully!"}


@router.put("/notifications/{notif_id}/folder", response_model=None)
@require_roles("employee", "manager", "admin")
async def update_notification_folder(notif_id: UUID, request: Request, data: dict):
    """
    Move a notification to a specific folder (inbox, sent, junk, deleted)
    """
    folder = data.get("folder")
    if folder not in ["inbox", "sent", "junk", "deleted"]:
        raise HTTPException(status_code=400, detail="Invalid folder name.")
        
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(MockNotification).filter(MockNotification.id == notif_id))
        notif = res.scalar_one_or_none()
        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found.")
            
        notif.folder = folder
        await session.commit()
        return {"message": f"Notification moved to {folder}."}


@router.post("/notifications/interactive-action", response_model=None)
@require_roles("manager", "admin")
async def handle_teams_interactive_callback(request: Request, data: dict):
    """
    Handles live MS Teams Adaptive Card Submit Actions!
    Action buttons (e.g. 'Approve Goal Sheet') dynamically trigger database workflows.
    The reviewer is always the authenticated user — recipient_email in the body is ignored
    to prevent privilege escalation via request body manipulation.
    """
    sheet_id = data.get("sheet_id")
    action = data.get("action")
    caller = request.state.user  # BUG-003 fix: use authenticated user, not body email

    if not sheet_id or not action:
        raise HTTPException(status_code=400, detail="Missing parameters.")

    async with AsyncSessionLocal() as session:
        res_sheet = await session.execute(select(GoalSheet).filter(GoalSheet.id == UUID(sheet_id)))
        sheet = res_sheet.scalar_one_or_none()
        if not sheet:
            raise HTTPException(status_code=404, detail="Goal sheet not found.")

        # Resolve the full reviewer record from the authenticated user's ID
        res_reviewer = await session.execute(select(User).filter(User.id == caller.id))
        reviewer = res_reviewer.scalar_one_or_none()
        if not reviewer:
            raise HTTPException(status_code=404, detail="Authenticated reviewer not found.")

        if action == "approve":
            if sheet.status != "submitted":
                raise HTTPException(
                    status_code=400,
                    detail=f"Sheet cannot be approved — current status is '{sheet.status}'."
                )
            sheet.status = "approved"
            sheet.approved_at = datetime.utcnow()
            sheet.approved_by = reviewer.id

            # Lock goals (UUID cast to str for raw SQL compatibility)
            await session.execute(
                text("UPDATE goals SET is_locked = True WHERE sheet_id = :sid"),
                {"sid": str(sheet.id)}
            )

            # Create a success Teams response notification for the reviewer
            notif = MockNotification(
                type="teams",
                recipient_id=reviewer.id,
                sender_name="System Actions",
                body=json.dumps({
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": "✅ Goal Sheet Approved",
                            "weight": "Bolder",
                            "color": "Good"
                        },
                        {
                            "type": "TextBlock",
                            "text": f"Goal Sheet #{str(sheet.id)[:4].upper()} was approved directly from Teams Adaptive Card callback by {reviewer.full_name}.",
                            "wrap": True
                        }
                    ]
                }),
                status="unread"
            )
            session.add(notif)
            await session.commit()
            return {"message": "Goal Sheet Approved directly via Adaptive Card callback!"}

        return {"message": "Callback executed successfully."}
