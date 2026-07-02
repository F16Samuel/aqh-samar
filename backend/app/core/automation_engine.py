import json
import logging
from datetime import datetime, timedelta
from sqlalchemy import select, text, and_, or_
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models.goal import GoalSheet, Goal, Achievement, CheckIn
from app.models.user import User
from app.models.cycle import Cycle
from app.models.automation import AutomationRule, EscalationTask, EscalationHistory, MockNotification
from app.core.utils import compute_progress_score

logger = logging.getLogger(__name__)

# =============================================================================
# Core Condition Check Engine
# =============================================================================

async def evaluate_rules_and_create_tasks():
    """
    Periodic job scanner:
    1. Fetches all active rules.
    2. Identifies matching records (draft sheets, submitted sheets, etc.) that breach rules.
    3. Creates or updates EscalationTasks.
    """
    async with AsyncSessionLocal() as session:
        # Load active rules
        res_rules = await session.execute(select(AutomationRule).filter(AutomationRule.is_active == True))
        rules = res_rules.scalars().all()
        
        # Load active cycle
        res_cycle = await session.execute(select(Cycle).filter(Cycle.is_active == True))
        active_cycle = res_cycle.scalar_one_or_none()
        if not active_cycle:
            logger.warning("No active cycle found. Skipping escalation rules run.")
            return

        now = datetime.utcnow()

        for rule in rules:
            try:
                breached_targets = []  # List of dicts: {"sheet_id": ..., "employee_id": ..., "reason": ...}
                
                # A. Evaluate specific trigger condition types
                if rule.trigger_type == "overdue_submission":
                    days_overdue = rule.conditions.get("days_overdue", 5)
                    # Check window start
                    window_open_dt = datetime.combine(active_cycle.window_open, datetime.min.time())
                    if now - window_open_dt >= timedelta(days=days_overdue):
                        # Find all employees who don't have an approved/submitted sheet for active cycle
                        # 1. Employees list
                        res_emp = await session.execute(select(User).filter(User.role == "employee", User.is_active == True))
                        employees = res_emp.scalars().all()
                        
                        for emp in employees:
                            res_sheet = await session.execute(
                                select(GoalSheet)
                                .filter(GoalSheet.employee_id == emp.id, GoalSheet.cycle_id == active_cycle.id)
                            )
                            sheet = res_sheet.scalar_one_or_none()
                            
                            # If no sheet created, or sheet is in draft/rework
                            if not sheet or sheet.status in ["draft", "rework"]:
                                breached_targets.append({
                                    "sheet_id": sheet.id if sheet else None,
                                    "employee_id": emp.id,
                                    "reason": f"Goal sheet remains unsubmitted {days_overdue} days after window opening."
                                })

                elif rule.trigger_type == "pending_approval":
                    days_overdue = rule.conditions.get("days_overdue", 7)
                    # Find all submitted sheets for active cycle submitted > days_overdue ago
                    res_sheets = await session.execute(
                        select(GoalSheet)
                        .filter(
                            GoalSheet.cycle_id == active_cycle.id,
                            GoalSheet.status == "submitted",
                            GoalSheet.submitted_at <= now - timedelta(days=days_overdue)
                        )
                    )
                    sheets = res_sheets.scalars().all()
                    for sh in sheets:
                        breached_targets.append({
                            "sheet_id": sh.id,
                            "employee_id": sh.employee_id,
                            "reason": f"Goal sheet pending review for {days_overdue}+ days."
                        })

                elif rule.trigger_type == "low_completion":
                    threshold = rule.conditions.get("threshold_percent", 50)
                    # Find approved/locked sheets
                    res_sheets = await session.execute(
                        select(GoalSheet)
                        .filter(GoalSheet.cycle_id == active_cycle.id, GoalSheet.status.in_(["approved", "locked"]))
                        .options(selectinload(GoalSheet.goals).selectinload(Goal.achievements))
                    )
                    sheets = res_sheets.scalars().all()
                    
                    for sh in sheets:
                        # Compute overall sheet score
                        avg_score = await calculate_sheet_progress(session, sh)
                        if avg_score < threshold:
                            breached_targets.append({
                                "sheet_id": sh.id,
                                "employee_id": sh.employee_id,
                                "reason": f"Overall completion rate ({avg_score:.1f}%) is below {threshold}% threshold."
                            })

                elif rule.trigger_type == "missing_checkin":
                    # Check current active quarter checkins
                    current_q = "Q2"  # Seeding active scenario quarter is Q2 (Current year is 2026)
                    # Find approved sheets lacking a checkin for current_q
                    res_sheets = await session.execute(
                        select(GoalSheet)
                        .filter(GoalSheet.cycle_id == active_cycle.id, GoalSheet.status.in_(["approved", "locked"]))
                    )
                    sheets = res_sheets.scalars().all()
                    for sh in sheets:
                        res_chk = await session.execute(
                            select(CheckIn)
                            .filter(CheckIn.sheet_id == sh.id, CheckIn.quarter == current_q)
                        )
                        if not res_chk.scalar_one_or_none():
                            breached_targets.append({
                                "sheet_id": sh.id,
                                "employee_id": sh.employee_id,
                                "reason": f"Missing manager quarterly check-in for {current_q}."
                            })

                elif rule.trigger_type == "inactivity":
                    days_inactive = rule.conditions.get("days_inactive", 10)
                    # Sheets not updated in days_inactive
                    res_sheets = await session.execute(
                        select(GoalSheet)
                        .filter(GoalSheet.cycle_id == active_cycle.id)
                        .options(selectinload(GoalSheet.goals).selectinload(Goal.achievements))
                    )
                    sheets = res_sheets.scalars().all()
                    for sh in sheets:
                        # Check last achievement update or checkin update
                        last_updated = sh.submitted_at or active_cycle.window_open
                        for g in sh.goals:
                            for a in g.achievements:
                                if a.updated_at > last_updated:
                                    last_updated = a.updated_at
                        
                        if now - last_updated >= timedelta(days=days_inactive):
                            breached_targets.append({
                                "sheet_id": sh.id,
                                "employee_id": sh.employee_id,
                                "reason": f"No activity recorded on sheet or achievements for {days_inactive}+ days."
                            })

                elif rule.trigger_type == "declining_performance":
                    threshold_drop = rule.conditions.get("threshold_percent", 15)
                    # Compare Q1 vs Q2 achievements
                    res_sheets = await session.execute(
                        select(GoalSheet)
                        .filter(GoalSheet.status.in_(["approved", "locked"]))
                        .options(selectinload(GoalSheet.goals).selectinload(Goal.achievements))
                    )
                    sheets = res_sheets.scalars().all()
                    for sh in sheets:
                        q1_score = await calculate_quarterly_score(session, sh, "Q1")
                        q2_score = await calculate_quarterly_score(session, sh, "Q2")
                        
                        # Only flag if both quarters had updates and performance dropped > threshold_drop
                        if q1_score > 0 and q2_score < q1_score:
                            pct_drop = ((q1_score - q2_score) / q1_score) * 100
                            if pct_drop >= threshold_drop:
                                breached_targets.append({
                                    "sheet_id": sh.id,
                                    "employee_id": sh.employee_id,
                                    "reason": f"Performance drop of {pct_drop:.1f}% QoQ (Q1: {q1_score:.1f}% -> Q2: {q2_score:.1f}%)."
                                })

                # B. Seed / Update active EscalationTasks for breaches
                for bt in breached_targets:
                    # Check if active task already exists for this rule and employee
                    res_t = await session.execute(
                        select(EscalationTask)
                        .filter(
                            EscalationTask.rule_id == rule.id,
                            EscalationTask.employee_id == bt["employee_id"],
                            EscalationTask.status.in_(["pending", "running"])
                        )
                    )
                    task = res_t.scalar_one_or_none()
                    
                    if not task:
                        # Create new escalation task
                        task = EscalationTask(
                            rule_id=rule.id,
                            goal_sheet_id=bt["sheet_id"],
                            employee_id=bt["employee_id"],
                            current_step_index=0,
                            status="running",
                            next_run_at=now,  # Run immediately
                            sla_deadline=now + timedelta(days=sum(step.get("delay_days", 0) for step in rule.actions))
                        )
                        session.add(task)
                        logger.info(f"Escalation Engine: Initialized new escalation for Rule '{rule.name}' targeting user {bt['employee_id']}.")
                
                await session.commit()

            except Exception as e:
                logger.error(f"Error evaluating rule {rule.name}: {e}", exc_info=True)
                await session.rollback()

        # C. Process running EscalationTasks
        await process_active_escalation_tasks(session, now)


async def process_active_escalation_tasks(session, now):
    """
    Executes next sequential action step of running escalation tasks if next_run_at <= now
    """
    res_tasks = await session.execute(
        select(EscalationTask)
        .filter(EscalationTask.status == "running", EscalationTask.next_run_at <= now)
        .options(selectinload(EscalationTask.rule), selectinload(EscalationTask.employee))
    )
    tasks = res_tasks.scalars().all()

    for task in tasks:
        try:
            rule = task.rule
            steps = rule.actions
            step_idx = task.current_step_index
            
            if step_idx >= len(steps):
                # Escalation fully processed
                task.status = "completed"
                await session.commit()
                continue
                
            step = steps[step_idx]
            
            # Fire the step action!
            success = await execute_action_step(session, task, step)
            
            # Record audit execution history
            history = EscalationHistory(
                task_id=task.id,
                rule_id=rule.id,
                action_type=step["type"],
                recipient_id=task.employee_id if step.get("recipient") == "employee" else task.employee.manager_id,
                status="success" if success else "failed",
                details=f"Step {step_idx}: Fired Action {step['type']}. Body: {step.get('body', '')}"
            )
            session.add(history)
            
            # Advance to next step
            task.current_step_index += 1
            if task.current_step_index < len(steps):
                next_step = steps[task.current_step_index]
                task.next_run_at = now + timedelta(days=next_step.get("delay_days", 1))
            else:
                task.status = "completed"
                
            await session.commit()
            
        except Exception as e:
            logger.error(f"Error executing escalation task {task.id}: {e}", exc_info=True)
            task.retry_count += 1
            if task.retry_count >= 3:
                task.status = "breached"  # Marked broken
            else:
                task.next_run_at = now + timedelta(hours=2)  # Retry in 2 hours
            await session.commit()


# =============================================================================
# Actions Dispatcher (Mock Notifications Hub backfill)
# =============================================================================

async def execute_action_step(session, task, step) -> bool:
    """
    Dispatches mock emails, interactive Teams adaptive cards, manager overrides, and workflow reassignments
    """
    employee = task.employee
    # Fetch manager
    res_mgr = await session.execute(select(User).filter(User.id == employee.manager_id))
    manager = res_mgr.scalar_one_or_none()
    
    action_type = step["type"]
    body_tmpl = step.get("body", "SLA escalation warning alert details.")
    body_text = body_tmpl.format(
        employee_name=employee.full_name,
        manager_name=manager.full_name if manager else "System",
        days_overdue=task.rule.conditions.get("days_overdue", 5),
        percent_drop="35.0"
    )

    if action_type == "email":
        recipient = employee if step.get("recipient") == "employee" else manager
        if not recipient:
            return False
            
        # Dispatch HTML Email to database mock store
        html_body = f"""
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background-color: #f43f5e; padding: 12px; border-radius: 6px; color: #fff; font-weight: bold; font-size: 16px; margin-bottom: 20px;">
                ⚠️ HMT-360 SLA Escalation Warning
            </div>
            <p>Hello <strong>{recipient.full_name}</strong>,</p>
            <p>This is an automated system notification regarding performance management windows and SLA compliance logs.</p>
            <blockquote style="background-color: #f5f5f5; border-left: 4px solid #f43f5e; padding: 10px; margin: 15px 0;">
                {body_text}
            </blockquote>
            <p style="margin-top: 25px;">Please log in to the Performance Portal immediately to take necessary action.</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="font-size: 11px; color: #888;">HMT-360 Escalation & Automated Workflow Engine. Confidential corporate notice.</p>
        </div>
        """
        notif = MockNotification(
            type="email",
            recipient_id=recipient.id,
            sender_name="HMT-360 Automator",
            subject=step.get("subject", "SLA Escalation Warning"),
            body=html_body,
            status="unread"
        )
        session.add(notif)
        return True

    elif action_type == "teams":
        recipient = employee if step.get("recipient") == "employee" else manager
        if not recipient:
            return False
            
        # Dispatch styled MS Teams Adaptive Card json string
        adaptive_card = {
            "type": "AdaptiveCard",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "🚨 SLA Escalation Warning",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Attention"
                },
                {
                    "type": "TextBlock",
                    "text": body_text,
                    "wrap": True
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {"title": "Employee", "value": employee.full_name},
                        {"title": "Department", "value": "Operations / Engineering"},
                        {"title": "Active Cycle", "value": "2026 Goal Cycle"}
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Open Goal Sheet",
                    "style": "positive",
                    "data": {
                        "action": "open_sheet",
                        "sheet_id": str(task.goal_sheet_id) if task.goal_sheet_id else ""
                    }
                }
            ]
        }
        
        notif = MockNotification(
            type="teams",
            recipient_id=recipient.id,
            sender_name="Microsoft Teams Alert",
            body=json.dumps(adaptive_card),
            status="unread",
            interactive_payload={"sheet_id": str(task.goal_sheet_id) if task.goal_sheet_id else "", "action": "open"}
        )
        session.add(notif)
        return True

    elif action_type == "manager_escalation":
        # Escalate to Manager's Manager (Skip-level manager)
        if not manager or not manager.manager_id:
            logger.warning(f"No skip-level manager found for employee {employee.full_name}. Defaulting to HR Admin.")
            # Target HR Admin (Neha Kapoor code)
            res_admin = await session.execute(select(User).filter(User.role == "admin"))
            hr_admin = res_admin.scalars().first()
            recipient_id = hr_admin.id if hr_admin else employee.id
        else:
            recipient_id = manager.manager_id
            
        teams_card = {
            "type": "AdaptiveCard",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "💥 Escalated SLA Breach Alert",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Attention"
                },
                {
                    "type": "TextBlock",
                    "text": f"Breach Alert: Direct Report manager has failed to review/comment. Escalated skip-level to your dashboard: {body_text}",
                    "wrap": True
                }
            ]
        }
        
        notif = MockNotification(
            type="teams",
            recipient_id=recipient_id,
            sender_name="Skip-level Manager Portal",
            body=json.dumps(teams_card),
            status="unread"
        )
        session.add(notif)
        return True

    elif action_type == "hr_escalation":
        # Target HR Admin (Neha Kapoor code)
        res_admin = await session.execute(select(User).filter(User.role == "admin"))
        hr_admin = res_admin.scalars().first()
        if not hr_admin:
            return False
            
        teams_card = {
            "type": "AdaptiveCard",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "🔥 HR Escalation Triggered",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Attention"
                },
                {
                    "type": "TextBlock",
                    "text": f"Critical SLA Breach has escalated to Human Resources partners. Goal tracking is severely stalled: {body_text}",
                    "wrap": True
                }
            ]
        }
        
        notif = MockNotification(
            type="teams",
            recipient_id=hr_admin.id,
            sender_name="HR Operations",
            body=json.dumps(teams_card),
            status="unread"
        )
        session.add(notif)
        return True

    elif action_type == "workflow_reassignment":
        if not task.goal_sheet_id:
            return False
            
        # Reassign review to skip-level manager, fallback to HR admin
        res_sheet = await session.execute(select(GoalSheet).filter(GoalSheet.id == task.goal_sheet_id))
        sheet = res_sheet.scalar_one_or_none()
        if not sheet or sheet.status != "submitted":
            return False
            
        if manager and manager.manager_id:
            reassign_id = manager.manager_id
            reassign_name = "Skip-Level Manager"
        else:
            res_admin = await session.execute(select(User).filter(User.role == "admin"))
            hr_admin = res_admin.scalars().first()
            if not hr_admin:
                return False
            reassign_id = hr_admin.id
            reassign_name = "HR Administrator"

        # Reassign sheet
        sheet.approved_by = reassign_id
        
        # Log to Teams Mock Hub
        teams_card = {
            "type": "AdaptiveCard",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "🔄 Workflow Reassigned Successfully",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Good"
                },
                {
                    "type": "TextBlock",
                    "text": f"SLA Violation auto-reassigned goal sheet review for {employee.full_name} directly to {reassign_name}.",
                    "wrap": True
                }
            ]
        }
        
        notif = MockNotification(
            type="teams",
            recipient_id=reassign_id,
            sender_name="System Orchestrator",
            body=json.dumps(teams_card),
            status="unread"
        )
        session.add(notif)
        return True

    return False


# =============================================================================
# Helper Progress Calculations
# =============================================================================

async def calculate_sheet_progress(session, sheet: GoalSheet) -> float:
    """
    Computes system progress score for a goal sheet by summing weightage-adjusted achievements.
    """
    if not sheet.goals:
        return 0.0
        
    total_weighted_score = 0.0
    for goal in sheet.goals:
        ach_q = [ach for ach in goal.achievements if ach.quarter == "Q2"]  # Seeding active Q2
        actual_val = ach_q[0].actual if ach_q else "0"
        
        g_score = compute_progress_score(goal.uom_type, goal.target, actual_val)
        total_weighted_score += (g_score * (goal.weightage / 100.0))
        
    return total_weighted_score


async def calculate_quarterly_score(session, sheet: GoalSheet, quarter: str) -> float:
    """
    Helper to calculate average completion rate for a sheet for a specific quarter.
    """
    if not sheet.goals:
        return 0.0
        
    scores = []
    for goal in sheet.goals:
        ach_q = [ach for ach in goal.achievements if ach.quarter == quarter]
        if ach_q:
            g_score = compute_progress_score(goal.uom_type, goal.target, ach_q[0].actual)
            scores.append(g_score)
            
    if not scores:
        return 0.0
    return sum(scores) / len(scores)


# =============================================================================
# Dry-Run Simulation Mode Engine
# =============================================================================

async def run_simulation_dryrun(rule_data: dict) -> list:
    """
    Runs an interactive dry-run simulation of an automation rule definition.
    Evaluates trigger parameters on active public schema rows without updating the database.
    """
    async with AsyncSessionLocal() as session:
        # Load active cycle
        res_cycle = await session.execute(select(Cycle).filter(Cycle.is_active == True))
        active_cycle = res_cycle.scalar_one_or_none()
        if not active_cycle:
            return [{"error": "No active cycle configured."}]

        trigger_type = rule_data.get("trigger_type")
        conditions = rule_data.get("conditions", {})
        actions = rule_data.get("actions", [])
        
        now = datetime.utcnow()
        simulation_logs = []

        if trigger_type == "overdue_submission":
            days_overdue = conditions.get("days_overdue", 5)
            window_open_dt = datetime.combine(active_cycle.window_open, datetime.min.time())
            
            res_emp = await session.execute(select(User).filter(User.role == "employee", User.is_active == True).options(selectinload(User.manager)))
            employees = res_emp.scalars().all()
            
            for emp in employees:
                res_sheet = await session.execute(select(GoalSheet).filter(GoalSheet.employee_id == emp.id, GoalSheet.cycle_id == active_cycle.id))
                sheet = res_sheet.scalar_one_or_none()
                
                if not sheet or sheet.status in ["draft", "rework"]:
                    breach_days = (now - window_open_dt).days
                    timeline_steps = []
                    for idx, act in enumerate(actions):
                        exec_date = now + timedelta(days=act.get("delay_days", 0))
                        timeline_steps.append({
                            "step": idx,
                            "type": act["type"],
                            "scheduled_at": exec_date.strftime("%Y-%m-%d %H:%M"),
                            "recipient": "Employee" if act.get("recipient") == "employee" else "Manager"
                        })
                    
                    simulation_logs.append({
                        "employee_name": emp.full_name,
                        "employee_email": emp.email,
                        "manager_name": emp.manager.full_name if emp.manager else "N/A",
                        "breach_metric": f"{breach_days} days overdue (Limit: {days_overdue} days)",
                        "status": "DRAFT STALLED" if sheet else "NO SHEET CREATED",
                        "timeline": timeline_steps
                    })

        elif trigger_type == "pending_approval":
            days_overdue = conditions.get("days_overdue", 7)
            res_sheets = await session.execute(
                select(GoalSheet)
                .filter(GoalSheet.cycle_id == active_cycle.id, GoalSheet.status == "submitted")
                .options(selectinload(GoalSheet.employee).selectinload(User.manager))
            )
            sheets = res_sheets.scalars().all()
            
            for sh in sheets:
                submitted_days = (now - sh.submitted_at).days
                if submitted_days >= days_overdue:
                    timeline_steps = []
                    for idx, act in enumerate(actions):
                        exec_date = now + timedelta(days=act.get("delay_days", 0))
                        timeline_steps.append({
                            "step": idx,
                            "type": act["type"],
                            "scheduled_at": exec_date.strftime("%Y-%m-%d %H:%M"),
                            "recipient": "Manager" if act.get("type") == "teams" else "HR Operations"
                        })
                    
                    simulation_logs.append({
                        "employee_name": sh.employee.full_name,
                        "employee_email": sh.employee.email,
                        "manager_name": sh.employee.manager.full_name if sh.employee.manager else "N/A",
                        "breach_metric": f"Submitted {submitted_days} days ago (SLA: {days_overdue} days)",
                        "status": "PENDING APPROVAL",
                        "timeline": timeline_steps
                    })

        elif trigger_type == "declining_performance":
            threshold_drop = conditions.get("threshold_percent", 15)
            res_sheets = await session.execute(
                select(GoalSheet)
                .filter(GoalSheet.status.in_(["approved", "locked"]))
                .options(selectinload(GoalSheet.employee).selectinload(User.manager), selectinload(GoalSheet.goals).selectinload(Goal.achievements))
            )
            sheets = res_sheets.scalars().all()
            
            for sh in sheets:
                q1_score = await calculate_quarterly_score(session, sh, "Q1")
                q2_score = await calculate_quarterly_score(session, sh, "Q2")
                
                if q1_score > 0 and q2_score < q1_score:
                    pct_drop = ((q1_score - q2_score) / q1_score) * 100
                    if pct_drop >= threshold_drop:
                        timeline_steps = []
                        for idx, act in enumerate(actions):
                            exec_date = now + timedelta(days=act.get("delay_days", 0))
                            timeline_steps.append({
                                "step": idx,
                                "type": act["type"],
                                "scheduled_at": exec_date.strftime("%Y-%m-%d %H:%M"),
                                "recipient": "Manager"
                            })
                            
                        simulation_logs.append({
                            "employee_name": sh.employee.full_name,
                            "employee_email": sh.employee.email,
                            "manager_name": sh.employee.manager.full_name if sh.employee.manager else "N/A",
                            "breach_metric": f"Score dropped by {pct_drop:.1f}% (Q1: {q1_score:.1f}% -> Q2: {q2_score:.1f}%)",
                            "status": "PERFORMANCE DECLINE",
                            "timeline": timeline_steps
                        })

        return simulation_logs
