import asyncio
import os
import sys
from sqlalchemy import text

# Add the app directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import engine, AsyncSessionLocal
from app.db.base import Base
import app.db.base_all  # Ensures all models are loaded
from app.models.automation import AutomationRule

async def main():
    print("Connecting to database and creating new automation tables...")
    async with engine.begin() as conn:
        # This will only create tables that do not exist yet. Safe for existing data.
        await conn.run_sync(Base.metadata.create_all)
    print("New tables created successfully!")

    print("Seeding default automation rules...")
    async with AsyncSessionLocal() as session:
        # Check if default rules already exist
        result = await session.execute(text("SELECT count(*) FROM automation_rules"))
        count = result.scalar()
        
        if count == 0:
            rule1 = AutomationRule(
                name="Goal Sheet Submission Reminder",
                description="Remind employees whose goal sheets are stuck in Draft/Rework. Escalate progressively from Employee -> Manager -> HR.",
                trigger_type="overdue_submission",
                conditions={"days_overdue": 5},
                actions=[
                    {"delay_days": 0, "type": "email", "recipient": "employee", "subject": "Reminder: Goal Sheet Draft Overdue"},
                    {"delay_days": 3, "type": "teams", "recipient": "employee", "body": "Your goal sheet is overdue for submission by {days_overdue} days. Please finalize and submit to your manager."},
                    {"delay_days": 7, "type": "manager_escalation", "body": "Employee {employee_name} has not submitted their goal sheet after multiple warnings. Please follow up."},
                    {"delay_days": 10, "type": "hr_escalation", "body": "Critical: Goal sheet for {employee_name} remains overdue. Escated to HR partners."}
                ],
                is_active=True
            )

            rule2 = AutomationRule(
                name="Goal Sheet Pending Approval SLA",
                description="Track manager reviews for submitted goal sheets. Auto-escalate and reassign workflow to skip-level manager if ignored.",
                trigger_type="pending_approval",
                conditions={"days_overdue": 7},
                actions=[
                    {"delay_days": 0, "type": "teams", "recipient": "manager", "body": "Goal sheet for {employee_name} has been pending your approval for 7 days. Please review."},
                    {"delay_days": 3, "type": "manager_escalation", "body": "Approval SLA Breach: Goal sheet for {employee_name} is stalled at Manager {manager_name}. Escalated to skip-level."},
                    {"delay_days": 7, "type": "workflow_reassignment", "body": "Critical approval SLA breach. Reassigning sheet review to skip-level manager/HR."}
                ],
                is_active=True
            )

            rule3 = AutomationRule(
                name="QoQ Performance Drop Warning",
                description="Automatically flag employees whose average achievement progress drops by >15% quarter-over-quarter. Prompts early check-in.",
                trigger_type="declining_performance",
                conditions={"threshold_percent": 15},
                actions=[
                    {"delay_days": 0, "type": "email", "recipient": "manager", "subject": "SLA Warning: Declining QoQ Performance Detected"},
                    {"delay_days": 5, "type": "manager_escalation", "body": "Performance Decline: {employee_name} average scores dropped by {percent_drop}% QoQ. Please schedule an alignment check-in."}
                ],
                is_active=True
            )

            session.add_all([rule1, rule2, rule3])
            await session.commit()
            print("Successfully seeded default escalation rules!")
        else:
            print("Default rules already exist. Skipping seed.")

if __name__ == "__main__":
    asyncio.run(main())
