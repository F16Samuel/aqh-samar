import asyncio
import os
import sys
from datetime import datetime

# Add the app directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app.db.base_all  # Ensure all models are registered
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.cycle import Cycle
from app.models.goal import GoalSheet, Goal, Achievement, CheckIn
from app.core.utils import compute_progress_score
from sqlalchemy import select, update

async def main():
    print("Starting DB population script...")
    
    async with AsyncSessionLocal() as session:
        # 1. Get Active Cycle
        cycle_res = await session.execute(select(Cycle).where(Cycle.is_active == True))
        cycle = cycle_res.scalar_one_or_none()
        if not cycle:
            print("Error: No active cycle found. Did you run seed.py?")
            return
            
        # 2. Get Users (Employees & Managers)
        users_res = await session.execute(select(User).where(User.role.in_(["employee", "manager"])))
        users = users_res.scalars().all()
        
        if not users:
            print("Error: No employees or managers found. Did you run seed.py?")
            return
            
        print(f"Found {len(users)} users. Populating goals...")
        
        for user in users:
            # Check if sheet exists
            sheet_res = await session.execute(
                select(GoalSheet).where(GoalSheet.employee_id == user.id, GoalSheet.cycle_id == cycle.id)
            )
            sheet = sheet_res.scalar_one_or_none()
            
            if not sheet:
                sheet = GoalSheet(
                    employee_id=user.id,
                    cycle_id=cycle.id,
                    status="draft"
                )
                session.add(sheet)
                await session.flush()
                print(f"Created GoalSheet for {user.full_name}")
            
            # Check if goals exist
            goals_res = await session.execute(select(Goal).where(Goal.sheet_id == sheet.id))
            goals = goals_res.scalars().all()
            
            if len(goals) == 0:
                print(f"Creating 4 Goals for {user.full_name}")
                new_goals = [
                    Goal(
                        sheet_id=sheet.id, thrust_area="Revenue Growth", title="Increase Q3 Sales",
                        uom_type="max", target="100000", weightage=25, is_locked=True
                    ),
                    Goal(
                        sheet_id=sheet.id, thrust_area="Operational Efficiency", title="Reduce Cloud Costs",
                        uom_type="min", target="5000", weightage=25, is_locked=True
                    ),
                    Goal(
                        sheet_id=sheet.id, thrust_area="System Reliability", title="Zero Sev-1 Incidents",
                        uom_type="zero", target="0", weightage=25, is_locked=True
                    ),
                    Goal(
                        sheet_id=sheet.id, thrust_area="Product Delivery", title="Ship v2.0 Platform",
                        uom_type="timeline", target="90", weightage=25, is_locked=True
                    ),
                ]
                for g in new_goals:
                    session.add(g)
                await session.flush()
                goals = new_goals
                
                # Approve the sheet
                sheet.status = "approved"
                sheet.submitted_at = datetime.utcnow()
                sheet.approved_at = datetime.utcnow()
                if user.manager_id:
                    sheet.approved_by = user.manager_id
                    
                # Add a manager check-in
                if user.manager_id:
                    checkin = CheckIn(
                        sheet_id=sheet.id,
                        manager_id=user.manager_id,
                        quarter="Q1",
                        comment="Great start to the year. Keep focus on the platform delivery."
                    )
                    session.add(checkin)
                
            # Add Achievements for Q1 and Q2 if not present
            for g in goals:
                ach_res = await session.execute(select(Achievement).where(Achievement.goal_id == g.id))
                achievements = ach_res.scalars().all()
                if len(achievements) == 0:
                    # Q1 Achievement (Partial Progress)
                    q1_val = 0
                    q2_val = 0
                    
                    target_val = float(g.target)
                    if g.uom_type == "max":
                        q1_val = target_val * 0.4
                        q2_val = target_val * 0.75
                    elif g.uom_type == "min":
                        q1_val = target_val * 1.5
                        q2_val = target_val * 1.1
                    elif g.uom_type == "zero":
                        q1_val = 2
                        q2_val = 0
                    elif g.uom_type == "timeline":
                        q1_val = 120
                        q2_val = 100
                        
                    ach1 = Achievement(
                        goal_id=g.id, cycle_id=cycle.id, quarter="Q1", actual=str(q1_val), status="on_track"
                    )
                    
                    ach2 = Achievement(
                        goal_id=g.id, cycle_id=cycle.id, quarter="Q2", actual=str(q2_val), status="on_track"
                    )
                    
                    session.add(ach1)
                    session.add(ach2)
                    
        await session.commit()
        print("Database fully populated with analytics-ready data!")

if __name__ == "__main__":
    asyncio.run(main())
