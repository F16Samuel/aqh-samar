import asyncio
import os
import sys
from datetime import date, datetime, timedelta
import uuid
import random

# Add the app directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from supabase import create_client, Client
from sqlalchemy import select, text
from app.core.config import settings
from app.db.session import engine, AsyncSessionLocal
import app.db.base_all
from app.db.base import Base

from app.models.department import Department
from app.models.user import User
from app.models.cycle import Cycle
from app.models.goal import GoalSheet, Goal, Achievement, CheckIn, AuditLog

async def async_main():
    print("WARNING: This will drop ALL data in Supabase Auth and Public schema.")
    print("Initializing Supabase client...")
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    
    # 1. Wipe Supabase Auth Users
    print("Fetching existing auth users...")
    # Supabase list_users is paginated but we assume < 50 users here
    users = supabase.auth.admin.list_users()
    print(f"Found {len(users)} auth users. Deleting...")
    for u in users:
        supabase.auth.admin.delete_user(u.id)
        
    print("Auth users deleted.")

    # 2. Wipe Public Schema
    print("Dropping public schema tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("Recreating public schema tables...")
        await conn.run_sync(Base.metadata.create_all)
        
    print("Schema recreated. Seeding comprehensive data...")

    async with AsyncSessionLocal() as session:
        # 3. Create Departments
        dept_names = ["Engineering", "Sales", "Marketing", "Human Resources", "Operations", "Finance", "Product"]
        depts = {}
        for d in dept_names:
            dept = Department(name=d)
            session.add(dept)
            depts[d] = dept
        await session.flush()
        
        # 4. Create Historical Cycles
        cycles = {}
        current_year = date.today().year
        for year in range(current_year - 5, current_year + 1):
            is_active = (year == current_year)
            c = Cycle(
                year=year,
                phase="Goal Setting" if is_active else "Completed",
                window_open=date(year, 1, 1),
                window_close=date(year, 12, 31),
                is_active=is_active
            )
            session.add(c)
            cycles[year] = c
        await session.flush()
        
        # 5. Create Users in Auth & DB
        user_profiles = [
            {"email": "admin@company.com", "name": "System Admin", "role": "admin", "dept": "Human Resources", "is_mgr": False},
            
            # Managers
            {"email": "mgr1@company.com", "name": "Engineering Manager", "role": "manager", "dept": "Engineering", "is_mgr": True},
            {"email": "mgr2@company.com", "name": "Sales Manager", "role": "manager", "dept": "Sales", "is_mgr": True},
            {"email": "mgr3@company.com", "name": "Marketing Manager", "role": "manager", "dept": "Marketing", "is_mgr": True},
            {"email": "mgr4@company.com", "name": "Product Manager", "role": "manager", "dept": "Product", "is_mgr": True},
            
            # Employees (Engineering)
            {"email": "emp1@company.com", "name": "Frontend Dev", "role": "employee", "dept": "Engineering", "mgr_email": "mgr1@company.com"},
            {"email": "emp2@company.com", "name": "Backend Dev", "role": "employee", "dept": "Engineering", "mgr_email": "mgr1@company.com"},
            {"email": "emp_new@company.com", "name": "New Hire Eng", "role": "employee", "dept": "Engineering", "mgr_email": "mgr1@company.com"},
            
            # Employees (Sales)
            {"email": "emp3@company.com", "name": "Sales Rep 1", "role": "employee", "dept": "Sales", "mgr_email": "mgr2@company.com"},
            {"email": "emp4@company.com", "name": "Sales Rep 2", "role": "employee", "dept": "Sales", "mgr_email": "mgr2@company.com"},
            {"email": "emp_stuck@company.com", "name": "Stalled Rep", "role": "employee", "dept": "Sales", "mgr_email": "mgr2@company.com"},
            
            # Employees (Marketing)
            {"email": "emp5@company.com", "name": "SEO Specialist", "role": "employee", "dept": "Marketing", "mgr_email": "mgr3@company.com"},
            {"email": "emp6@company.com", "name": "Content Writer", "role": "employee", "dept": "Marketing", "mgr_email": "mgr3@company.com"},
            
            # Employees (Product)
            {"email": "emp7@company.com", "name": "UX Designer", "role": "employee", "dept": "Product", "mgr_email": "mgr4@company.com"},
            {"email": "emp8@company.com", "name": "Product Owner", "role": "employee", "dept": "Product", "mgr_email": "mgr4@company.com"},
        ]
        
        users_db = {}
        for up in user_profiles:
            res = supabase.auth.admin.create_user({
                "email": up["email"],
                "password": "password123",
                "email_confirm": True
            })
            uid = res.user.id
            u = User(
                id=uid,
                email=up["email"],
                full_name=up["name"],
                role=up["role"],
                department_id=depts[up["dept"]].id
            )
            session.add(u)
            users_db[up["email"]] = u
        await session.flush()
        
        # Assign Managers
        for up in user_profiles:
            if "mgr_email" in up:
                users_db[up["email"]].manager_id = users_db[up["mgr_email"]].id
                
        await session.flush()

        # 6. Generate Historical Data for Past Years
        for year in range(current_year - 5, current_year):
            cyc = cycles[year]
            for email, u in users_db.items():
                if u.role in ["employee", "manager"]:
                    # Randomize performance per year
                    is_great_year = random.choice([True, False])
                    
                    sheet = GoalSheet(
                        employee_id=u.id,
                        cycle_id=cyc.id,
                        status="locked", # Historical sheets should be locked/approved
                        submitted_at=datetime(year, 1, 15),
                        approved_at=datetime(year, 1, 20),
                        approved_by=u.manager_id if u.manager_id else None
                    )
                    session.add(sheet)
                    await session.flush()
                    
                    g1 = Goal(sheet_id=sheet.id, thrust_area="KPIs", title=f"Core Objective {year}", uom_type="max", target="100", weightage=60, is_locked=True)
                    g2 = Goal(sheet_id=sheet.id, thrust_area="Learning", title=f"Training {year}", uom_type="timeline", target="100", weightage=40, is_locked=True)
                    session.add_all([g1, g2])
                    await session.flush()
                    
                    # Achievements
                    for q in ["Q1", "Q2", "Q3", "Q4"]:
                        val1 = random.randint(80, 110) if is_great_year else random.randint(40, 70)
                        val2 = random.randint(80, 100) if is_great_year else random.randint(30, 60)
                        a1 = Achievement(goal_id=g1.id, cycle_id=cyc.id, quarter=q, actual=str(val1), status="completed" if q=="Q4" else "on_track")
                        a2 = Achievement(goal_id=g2.id, cycle_id=cyc.id, quarter=q, actual=str(val2), status="completed" if q=="Q4" else "on_track")
                        session.add_all([a1, a2])
                        
                    # Manager checkins
                    if u.manager_id:
                        for q in ["Q1", "Q2", "Q3", "Q4"]:
                            chk = CheckIn(sheet_id=sheet.id, manager_id=u.manager_id, quarter=q, comment=f"{q} review for {year}. {'Excellent work.' if is_great_year else 'Needs improvement.'}")
                            session.add(chk)

        # 7. Current Year Edge Cases (The comprehensive test suite)
        cyc_curr = cycles[current_year]
        
        # Scenario A: The Good Employee (emp1) - Fully approved and locked for Q1
        sheet_emp1 = GoalSheet(employee_id=users_db["emp1@company.com"].id, cycle_id=cyc_curr.id, status="locked", submitted_at=datetime.utcnow()-timedelta(days=30), approved_at=datetime.utcnow()-timedelta(days=29), approved_by=users_db["mgr1@company.com"].id)
        session.add(sheet_emp1)
        await session.flush()
        g_emp1_1 = Goal(sheet_id=sheet_emp1.id, thrust_area="Development", title="Ship Feature X", uom_type="timeline", target="100", weightage=50, is_locked=True)
        g_emp1_2 = Goal(sheet_id=sheet_emp1.id, thrust_area="Bugs", title="Zero Sev-1s", uom_type="zero", target="0", weightage=50, is_locked=True)
        session.add_all([g_emp1_1, g_emp1_2])
        await session.flush()
        
        # Scenario B: The Returned Sheet (emp2) - Manager sent it back
        sheet_emp2 = GoalSheet(employee_id=users_db["emp2@company.com"].id, cycle_id=cyc_curr.id, status="returned", submitted_at=datetime.utcnow()-timedelta(days=5))
        session.add(sheet_emp2)
        await session.flush()
        g_emp2 = Goal(sheet_id=sheet_emp2.id, thrust_area="API", title="Refactor Auth", uom_type="min", target="50", weightage=100) # Manager rejected it because they wanted 50ms latency, but target was set to 500
        session.add(g_emp2)
        chk_return = CheckIn(sheet_id=sheet_emp2.id, manager_id=users_db["mgr1@company.com"].id, quarter="Q1", comment="Please adjust target for Auth latency to 50ms instead of 500ms.")
        session.add(chk_return)
        
        # Scenario C: The New Hire (emp_new) - Empty Draft
        sheet_empnew = GoalSheet(employee_id=users_db["emp_new@company.com"].id, cycle_id=cyc_curr.id, status="draft")
        session.add(sheet_empnew) # No goals yet
        
        # Scenario D: Under-allocated Draft (emp3)
        sheet_emp3 = GoalSheet(employee_id=users_db["emp3@company.com"].id, cycle_id=cyc_curr.id, status="draft")
        session.add(sheet_emp3)
        await session.flush()
        g_emp3 = Goal(sheet_id=sheet_emp3.id, thrust_area="Outbound", title="Cold Calls", uom_type="max", target="1000", weightage=30)
        session.add(g_emp3)
        
        # Scenario E: Pending Approval (emp4) - Waiting for manager
        sheet_emp4 = GoalSheet(employee_id=users_db["emp4@company.com"].id, cycle_id=cyc_curr.id, status="submitted", submitted_at=datetime.utcnow()-timedelta(days=2))
        session.add(sheet_emp4)
        await session.flush()
        g_emp4_1 = Goal(sheet_id=sheet_emp4.id, thrust_area="Sales", title="Close $1M", uom_type="max", target="1000000", weightage=50)
        g_emp4_2 = Goal(sheet_id=sheet_emp4.id, thrust_area="Upsell", title="Upsell existing", uom_type="max", target="200000", weightage=50)
        session.add_all([g_emp4_1, g_emp4_2])
        
        # Scenario F: The Escalation (emp_stuck) - Submitted 15 days ago, mgr2 ignored it
        sheet_stuck = GoalSheet(employee_id=users_db["emp_stuck@company.com"].id, cycle_id=cyc_curr.id, status="submitted", submitted_at=datetime.utcnow()-timedelta(days=15))
        session.add(sheet_stuck)
        await session.flush()
        g_stuck = Goal(sheet_id=sheet_stuck.id, thrust_area="Sales", title="Close $500k", uom_type="max", target="500000", weightage=100)
        session.add(g_stuck)
        
        # Scenario G: Shared Goals (Marketing dept)
        sheet_mgr3 = GoalSheet(employee_id=users_db["mgr3@company.com"].id, cycle_id=cyc_curr.id, status="approved", submitted_at=datetime.utcnow()-timedelta(days=20), approved_at=datetime.utcnow()-timedelta(days=19))
        session.add(sheet_mgr3)
        await session.flush()
        base_goal = Goal(sheet_id=sheet_mgr3.id, thrust_area="Brand", title="Increase Traffic 50%", uom_type="max", target="50", weightage=40, is_locked=True)
        session.add(base_goal)
        await session.flush()
        
        # Distribute to emp5 and emp6
        sheet_emp5 = GoalSheet(employee_id=users_db["emp5@company.com"].id, cycle_id=cyc_curr.id, status="approved", submitted_at=datetime.utcnow()-timedelta(days=18), approved_at=datetime.utcnow()-timedelta(days=17))
        sheet_emp6 = GoalSheet(employee_id=users_db["emp6@company.com"].id, cycle_id=cyc_curr.id, status="approved", submitted_at=datetime.utcnow()-timedelta(days=18), approved_at=datetime.utcnow()-timedelta(days=17))
        session.add_all([sheet_emp5, sheet_emp6])
        await session.flush()
        
        shared5 = Goal(sheet_id=sheet_emp5.id, thrust_area="Brand", title="Increase Traffic 50%", uom_type="max", target="50", weightage=50, shared_from=base_goal.id, is_locked=True)
        shared6 = Goal(sheet_id=sheet_emp6.id, thrust_area="Brand", title="Increase Traffic 50%", uom_type="max", target="50", weightage=60, shared_from=base_goal.id, is_locked=True)
        
        # Add custom goals to hit 100%
        custom5 = Goal(sheet_id=sheet_emp5.id, thrust_area="SEO", title="Rank Top 3", uom_type="max", target="10", weightage=50, is_locked=True)
        custom6 = Goal(sheet_id=sheet_emp6.id, thrust_area="Content", title="Publish 10 articles", uom_type="max", target="10", weightage=40, is_locked=True)
        session.add_all([shared5, shared6, custom5, custom6])
        await session.flush()

        # Scenario H: Audit Log (Force Unlock Edge Case)
        # We will create a goal for emp7, approve it, lock it, and then simulate an admin unlocking it.
        sheet_emp7 = GoalSheet(employee_id=users_db["emp7@company.com"].id, cycle_id=cyc_curr.id, status="approved", submitted_at=datetime.utcnow()-timedelta(days=25), approved_at=datetime.utcnow()-timedelta(days=24))
        session.add(sheet_emp7)
        await session.flush()
        g_emp7 = Goal(sheet_id=sheet_emp7.id, thrust_area="Design", title="Redesign Portal", uom_type="timeline", target="100", weightage=100, is_locked=False) # Unlocked by admin!
        session.add(g_emp7)
        await session.flush()
        
        # Add Audit log
        log = AuditLog(
            goal_id=g_emp7.id,
            changed_by=users_db["admin@company.com"].id,
            field_name="is_locked",
            old_value="True",
            new_value="False",
            changed_at=datetime.utcnow() - timedelta(days=1)
        )
        session.add(log)
        
        # Scenario I: Null Sheet (emp8 has completely ignored the system, no GoalSheet at all)

        await session.commit()
        print("Database comprehensive wipe and seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(async_main())
