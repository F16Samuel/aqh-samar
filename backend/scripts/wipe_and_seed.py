import asyncio
import os
import sys
import json
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
    auth_users = supabase.auth.admin.list_users()
    print(f"Found {len(auth_users)} auth users. Deleting...")
    for u in auth_users:
        supabase.auth.admin.delete_user(u.id)
        
    print("Auth users wiped.")

    # 2. Wipe Public Schema
    print("Dropping public schema tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("Recreating public schema tables...")
        await conn.run_sync(Base.metadata.create_all)
        
    print("Schema recreated. Seeding comprehensive mid-sized SaaS operational dataset...")

    async with AsyncSessionLocal() as session:
        # 3. Create SaaS Departments
        dept_names = [
            "Engineering",
            "Product",
            "Revenue Operations",
            "Customer Success",
            "Finance",
            "Security & Compliance",
            "Data & AI",
            "Platform Infrastructure",
            "People Operations"
        ]
        depts = {}
        for d in dept_names:
            dept = Department(name=d)
            session.add(dept)
            depts[d] = dept
        await session.flush()
        
        # 4. Create Historical & Active Cycles
        cycles = {}
        current_year = date.today().year
        
        # Historical Cycle 1
        c_hist = Cycle(
            year=current_year - 1,
            phase="Q4 / Annual",
            window_open=date(current_year - 1, 1, 1),
            window_close=date(current_year - 1, 12, 31),
            is_active=False
        )
        session.add(c_hist)
        cycles[current_year - 1] = c_hist
        
        # Active Cycle
        c_active = Cycle(
            year=current_year,
            phase="Phase 1 - Goal Setting",
            window_open=date(current_year, 1, 1),
            window_close=date(current_year, 12, 31),
            is_active=True
        )
        session.add(c_active)
        cycles[current_year] = c_active
        await session.flush()

        # 5. Define SaaS User Structure & Attributes
        # Traits: strict, lenient, detail_oriented, disengaged
        user_profiles = [
            # Admin
            {"email": "admin@company.com", "name": "Neha Kapoor", "role": "admin", "dept": "People Operations", "title": "Head of People Operations", "code": "EMP-00001", "location": "Remote", "is_active": True},
            
            # Managers
            {"email": "mgr1@company.com", "name": "Aman Sethi", "role": "manager", "dept": "Platform Infrastructure", "title": "Director of Platform Infrastructure", "code": "EMP-00101", "location": "NYC Office", "trait": "strict", "is_active": True},
            {"email": "mgr2@company.com", "name": "Elena Rostova", "role": "manager", "dept": "Product", "title": "VP of Product Management", "code": "EMP-00102", "location": "Remote", "trait": "lenient", "is_active": True},
            {"email": "mgr3@company.com", "name": "Sarah Jenkins", "role": "manager", "dept": "Customer Success", "title": "Head of Customer Success", "code": "EMP-00103", "location": "SF Office", "trait": "detail_oriented", "is_active": True},
            {"email": "mgr4@company.com", "name": "Marcus Aurelius", "role": "manager", "dept": "Security & Compliance", "title": "Chief Security & Compliance Officer", "code": "EMP-00104", "location": "Remote", "trait": "disengaged", "is_active": True},
            {"email": "mgr5@company.com", "name": "David Chen", "role": "manager", "dept": "Revenue Operations", "title": "VP of Revenue Operations", "code": "EMP-00105", "location": "SF Office", "trait": "detail_oriented", "is_active": True},
            
            # Employees under Aman Sethi (mgr1) - Overloaded Engineering/Infra Team
            {"email": "emp1@company.com", "name": "Rhea Mukherjee", "role": "employee", "dept": "Platform Infrastructure", "title": "Senior Platform Reliability Engineer", "code": "EMP-00201", "location": "Remote", "mgr": "mgr1@company.com", "is_active": True},
            {"email": "emp2@company.com", "name": "Tariq Mahmood", "role": "employee", "dept": "Platform Infrastructure", "title": "Staff Cloud Architect", "code": "EMP-00202", "location": "NYC Office", "mgr": "mgr1@company.com", "is_active": True},
            {"email": "emp3@company.com", "name": "Chloe Zhao", "role": "employee", "dept": "Engineering", "title": "Security Engineering Lead", "code": "EMP-00203", "location": "SF Office", "mgr": "mgr1@company.com", "is_active": True},
            {"email": "emp4@company.com", "name": "Oliver Hansen", "role": "employee", "dept": "Engineering", "title": "Senior Backend Engineer", "code": "EMP-00204", "location": "Remote", "mgr": "mgr1@company.com", "is_active": True},
            {"email": "emp5@company.com", "name": "Jia-Hao Lin", "role": "employee", "dept": "Engineering", "title": "Backend Engineer", "code": "EMP-00205", "location": "Remote", "mgr": "mgr1@company.com", "is_active": False}, # Resigned/Inactive
            {"email": "emp6@company.com", "name": "Sonia Patel", "role": "employee", "dept": "Platform Infrastructure", "title": "Infrastructure Support Analyst", "code": "EMP-00206", "location": "SF Office", "mgr": "mgr1@company.com", "is_active": True},
            {"email": "emp7@company.com", "name": "Dmitry Volkov", "role": "employee", "dept": "Platform Infrastructure", "title": "DevOps Engineer", "code": "EMP-00207", "location": "Remote", "mgr": "mgr1@company.com", "is_active": True},
            
            # Employees under Elena Rostova (mgr2) - High-Performing Product Team
            {"email": "emp8@company.com", "name": "Yasmine Belkacem", "role": "employee", "dept": "Product", "title": "Lead Product Designer", "code": "EMP-00208", "location": "Remote", "mgr": "mgr2@company.com", "is_active": True},
            {"email": "emp9@company.com", "name": "Aidan O'Connor", "role": "employee", "dept": "Product", "title": "Senior Product Manager", "code": "EMP-00209", "location": "NYC Office", "mgr": "mgr2@company.com", "is_active": True},
            {"email": "emp10@company.com", "name": "Mei-Ling Wang", "role": "employee", "dept": "Product", "title": "Product Analyst", "code": "EMP-00210", "location": "SF Office", "mgr": "mgr2@company.com", "is_active": True},
            
            # Employees under David Chen (mgr5) - High-Performing RevOps
            {"email": "emp11@company.com", "name": "Julian Alvarez", "role": "employee", "dept": "Revenue Operations", "title": "Revenue Operations Lead", "code": "EMP-00211", "location": "Remote", "mgr": "mgr5@company.com", "is_active": True},
            {"email": "emp12@company.com", "name": "Ravi Shankar", "role": "employee", "dept": "Revenue Operations", "title": "Billing Systems Analyst", "code": "EMP-00212", "location": "SF Office", "mgr": "mgr5@company.com", "is_active": True},
            
            # Employees under Sarah Jenkins (mgr3) - CS / Finance
            {"email": "emp13@company.com", "name": "Hannah Abbott", "role": "employee", "dept": "Customer Success", "title": "Enterprise Success Manager", "code": "EMP-00213", "location": "SF Office", "mgr": "mgr3@company.com", "is_active": True},
            {"email": "emp14@company.com", "name": "Pedro Gomez", "role": "employee", "dept": "Customer Success", "title": "Customer Support Escalations Lead", "code": "EMP-00214", "location": "SF Office", "mgr": "mgr3@company.com", "is_active": True},
            {"email": "emp15@company.com", "name": "Fatima Al-Sayed", "role": "employee", "dept": "Customer Success", "title": "Customer Onboarding Specialist", "code": "EMP-00215", "location": "Remote", "mgr": "mgr3@company.com", "is_active": True},
            {"email": "emp16@company.com", "name": "James Sterling", "role": "employee", "dept": "Finance", "title": "Senior Corporate Controller", "code": "EMP-00216", "location": "NYC Office", "mgr": "mgr3@company.com", "is_active": True},
            
            # Employees under Marcus Aurelius (mgr4) - Security & Compliance / Data & AI
            {"email": "emp17@company.com", "name": "Alana Vance", "role": "employee", "dept": "Security & Compliance", "title": "Security Compliance Manager", "code": "EMP-00217", "location": "Remote", "mgr": "mgr4@company.com", "is_active": True},
            {"email": "emp18@company.com", "name": "Kojo Mensah", "role": "employee", "dept": "Security & Compliance", "title": "Compliance Audit Coordinator", "code": "EMP-00218", "location": "Remote", "mgr": "mgr4@company.com", "is_active": True},
            {"email": "emp19@company.com", "name": "Zoe Dubois", "role": "employee", "dept": "Data & AI", "title": "Senior Data & AI Scientist", "code": "EMP-00219", "location": "Remote", "mgr": "mgr4@company.com", "is_active": True},
            
            # Employee under Admin (Neha Kapoor)
            {"email": "emp20@company.com", "name": "Isabella Rossi", "role": "employee", "dept": "People Operations", "title": "People Partner", "code": "EMP-00220", "location": "Remote", "mgr": "admin@company.com", "is_active": True}
        ]

        # 6. Verify Reporting Hierarchy Integrity
        print("Checking Reporting Hierarchy Integrity...")
        email_to_profile = {p["email"]: p for p in user_profiles}
        for p in user_profiles:
            mgr_email = p.get("mgr")
            if mgr_email:
                # Rule A: Employees cannot manage admins
                mgr = email_to_profile[mgr_email]
                if p["role"] == "employee" and mgr["role"] == "admin":
                    # This is allowed under special circumstances, but employees cannot have admin permissions under them
                    pass
                if p["role"] == "admin" and mgr["role"] == "employee":
                    raise AssertionError(f"Hierarchy violation: Admin {p['email']} is managed by employee {mgr_email}!")
                
                # Rule B: Cyclic reporting chains check
                chain = [p["email"]]
                curr = mgr_email
                while curr:
                    if curr in chain:
                        raise AssertionError(f"Cyclic reporting detected! Chain: {' -> '.join(chain)} -> {curr}")
                    chain.append(curr)
                    curr_prof = email_to_profile.get(curr)
                    curr = curr_prof.get("mgr") if curr_prof else None
        
        print("Hierarchy integrity validated successfully. Re-creating auth profiles and users...")

        # 7. Create Users in Supabase Auth & Public DB
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
                platform_role=up["role"],
                job_title=up["title"],
                department_id=depts[up["dept"]].id,
                is_active=up["is_active"],
                employment_type="Full-time" if up["is_active"] else "Resigned",
                employee_code=up["code"],
                location=up["location"]
            )
            session.add(u)
            users_db[up["email"]] = u
        await session.flush()
        
        # Assign managers in DB
        for up in user_profiles:
            if "mgr" in up:
                users_db[up["email"]].manager_id = users_db[up["mgr"]].id
        await session.flush()

        # 8. Seed Historical Sheets (Locked, complete)
        print("Generating historical performance records (Temporal Drift Staggering)...")
        cyc_hist = cycles[current_year - 1]
        
        # Seed sheets for active historical users
        for email, u in users_db.items():
            if u.platform_role in ["employee", "manager"] and u.is_active:
                # Add temporal drift for historical sheets
                sub_days = random.randint(340, 360)
                app_days = sub_days - random.randint(2, 7)
                
                sheet = GoalSheet(
                    employee_id=u.id,
                    cycle_id=cyc_hist.id,
                    status="locked",
                    submitted_at=datetime.utcnow() - timedelta(days=sub_days),
                    approved_at=datetime.utcnow() - timedelta(days=app_days),
                    approved_by=u.manager_id if u.manager_id else None
                )
                session.add(sheet)
                await session.flush()
                
                g1 = Goal(sheet_id=sheet.id, thrust_area="KPIs", title=f"Deliver Core Q{random.randint(1,4)} Project", uom_type="max", target="100", weightage=60, is_locked=True)
                g2 = Goal(sheet_id=sheet.id, thrust_area="Professional growth", title="SOC2 Audit training completion", uom_type="timeline", target="100", weightage=40, is_locked=True)
                session.add_all([g1, g2])
                await session.flush()
                
                # Stagger historical achievements & checkins
                for idx, q in enumerate(["Q1", "Q2", "Q3", "Q4"]):
                    ach_days = 365 - (idx * 90) - random.randint(1, 10)
                    val1 = random.randint(85, 115)
                    val2 = random.randint(90, 100)
                    a1 = Achievement(goal_id=g1.id, cycle_id=cyc_hist.id, quarter=q, actual=str(val1), status="completed" if q=="Q4" else "on_track", updated_at=datetime.utcnow() - timedelta(days=ach_days))
                    a2 = Achievement(goal_id=g2.id, cycle_id=cyc_hist.id, quarter=q, actual=str(val2), status="completed" if q=="Q4" else "on_track", updated_at=datetime.utcnow() - timedelta(days=ach_days))
                    session.add_all([a1, a2])
                    
                    if u.manager_id:
                        chk_days = ach_days - random.randint(2, 5)
                        mgr_profile = email_to_profile[up["mgr"]] if "mgr" in up else {"trait": "detail_oriented"}
                        trait = mgr_profile.get("trait", "detail_oriented")
                        
                        if trait == "strict":
                            comment = f"{q} audit score verified. Target achievements present, but cross-team velocity needs tight focus in subsequent quarters."
                        elif trait == "lenient":
                            comment = f"{q} performance was spectacular! Absolute joy working together, and target has been fully smashed!"
                        elif trait == "detail_oriented":
                            comment = f"{q} metrics: verified deliverable. Technical excellence is high with Q{idx+1} scores logged at {val1}%. Keep driving the roadmap."
                        else:
                            comment = f"Logged."
                            
                        chk = CheckIn(
                            sheet_id=sheet.id,
                            manager_id=u.manager_id,
                            quarter=q,
                            comment=comment,
                            created_at=datetime.utcnow() - timedelta(days=chk_days)
                        )
                        session.add(chk)

        # 9. Seed Active Cycle Complex Scenarios (Full E2E Edge Case Suite)
        print("Generating active cycle complex operational edge cases...")
        cyc_curr = cycles[current_year]

        # --- SCENARIO A: The Standard Stellar Performer (emp1) ---
        # Under Aman Sethi (mgr1 - Strict). Approved & Locked for Q1, Q2.
        sheet_emp1 = GoalSheet(
            employee_id=users_db["emp1@company.com"].id,
            cycle_id=cyc_curr.id,
            status="locked",
            submitted_at=datetime.utcnow() - timedelta(days=45),
            approved_at=datetime.utcnow() - timedelta(days=43),
            approved_by=users_db["mgr1@company.com"].id
        )
        session.add(sheet_emp1)
        await session.flush()
        
        g_emp1_1 = Goal(sheet_id=sheet_emp1.id, thrust_area="Platform Reliability", title="Reduce CareSync API p95 latency from 780ms to below 300ms", uom_type="min", target="300", weightage=50, is_locked=True)
        g_emp1_2 = Goal(sheet_id=sheet_emp1.id, thrust_area="Operational Excellence", title="Zero Sev-1 production incidents", uom_type="zero", target="0", weightage=50, is_locked=True)
        session.add_all([g_emp1_1, g_emp1_2])
        await session.flush()
        
        # Achievements (Strict manager reviews, slightly staggered)
        a_emp1_q1_1 = Achievement(goal_id=g_emp1_1.id, cycle_id=cyc_curr.id, quarter="Q1", actual="340", status="on_track", updated_at=datetime.utcnow() - timedelta(days=35))
        a_emp1_q1_2 = Achievement(goal_id=g_emp1_2.id, cycle_id=cyc_curr.id, quarter="Q1", actual="0", status="on_track", updated_at=datetime.utcnow() - timedelta(days=35))
        a_emp1_q2_1 = Achievement(goal_id=g_emp1_1.id, cycle_id=cyc_curr.id, quarter="Q2", actual="280", status="completed", updated_at=datetime.utcnow() - timedelta(days=5))
        a_emp1_q2_2 = Achievement(goal_id=g_emp1_2.id, cycle_id=cyc_curr.id, quarter="Q2", actual="1", status="on_track", updated_at=datetime.utcnow() - timedelta(days=5)) # Incident logged!
        session.add_all([a_emp1_q1_1, a_emp1_q1_2, a_emp1_q2_1, a_emp1_q2_2])
        
        chk_emp1_q1 = CheckIn(sheet_id=sheet_emp1.id, manager_id=users_db["mgr1@company.com"].id, quarter="Q1", comment="P95 latency stands at 340ms, closing in on our 300ms limit. Safe incidents recorded at zero. Tighter oversight required on middleware migrations.", created_at=datetime.utcnow() - timedelta(days=32))
        chk_emp1_q2 = CheckIn(sheet_id=sheet_emp1.id, manager_id=users_db["mgr1@company.com"].id, quarter="Q2", comment="API latency goals reached successfully at 280ms. However, a Sev-1 outage occurred during our June deployment. Restructure post-mortem processes immediately.", created_at=datetime.utcnow() - timedelta(days=3))
        session.add_all([chk_emp1_q1, chk_emp1_q2])

        # --- SCENARIO B: Outlier Performer (emp2) ---
        # Elena Rostova (mgr2 - Lenient). Superb Q1/Q2 achievements (exceeding 100%).
        sheet_emp2 = GoalSheet(
            employee_id=users_db["emp2@company.com"].id,
            cycle_id=cyc_curr.id,
            status="locked",
            submitted_at=datetime.utcnow() - timedelta(days=46),
            approved_at=datetime.utcnow() - timedelta(days=44),
            approved_by=users_db["mgr1@company.com"].id
        )
        session.add(sheet_emp2)
        await session.flush()
        
        g_emp2_1 = Goal(sheet_id=sheet_emp2.id, thrust_area="Technical Debt Reduction", title="Migrate auth token refresh flow to centralized session middleware", uom_type="timeline", target="100", weightage=60, is_locked=True)
        g_emp2_2 = Goal(sheet_id=sheet_emp2.id, thrust_area="Operational Excellence", title="Automate 10 infrastructure backups", uom_type="max", target="10", weightage=40, is_locked=True)
        session.add_all([g_emp2_1, g_emp2_2])
        await session.flush()
        
        # Outlier overachievements
        a_emp2_q1_1 = Achievement(goal_id=g_emp2_1.id, cycle_id=cyc_curr.id, quarter="Q1", actual="80", status="on_track", updated_at=datetime.utcnow() - timedelta(days=36))
        a_emp2_q1_2 = Achievement(goal_id=g_emp2_2.id, cycle_id=cyc_curr.id, quarter="Q1", actual="8", status="on_track", updated_at=datetime.utcnow() - timedelta(days=36))
        a_emp2_q2_1 = Achievement(goal_id=g_emp2_1.id, cycle_id=cyc_curr.id, quarter="Q2", actual="100", status="completed", updated_at=datetime.utcnow() - timedelta(days=6))
        a_emp2_q2_2 = Achievement(goal_id=g_emp2_2.id, cycle_id=cyc_curr.id, quarter="Q2", actual="15", status="completed", updated_at=datetime.utcnow() - timedelta(days=6)) # 150% achievement!
        session.add_all([a_emp2_q1_1, a_emp2_q1_2, a_emp2_q2_1, a_emp2_q2_2])
        
        chk_emp2_q1 = CheckIn(sheet_id=sheet_emp2.id, manager_id=users_db["mgr1@company.com"].id, quarter="Q1", comment="Remarkable delivery on database backups. Centralized token migrations are progressing ahead of schedule.", created_at=datetime.utcnow() - timedelta(days=33))
        chk_emp2_q2 = CheckIn(sheet_id=sheet_emp2.id, manager_id=users_db["mgr1@company.com"].id, quarter="Q2", comment="Outstanding work Tariq! Automated 15 backups (far exceeding our target of 10) and completely wrapped up session migrations. Fantastic engineer!", created_at=datetime.utcnow() - timedelta(days=4))
        session.add_all([chk_emp2_q1, chk_emp2_q2])

        # --- SCENARIO C: Active Escalation (emp13) ---
        # Under Sarah Jenkins (mgr3). Submitted 16 days ago and completely ignored.
        sheet_emp13 = GoalSheet(
            employee_id=users_db["emp13@company.com"].id,
            cycle_id=cyc_curr.id,
            status="submitted",
            submitted_at=datetime.utcnow() - timedelta(days=16)
        )
        session.add(sheet_emp13)
        await session.flush()
        
        g_emp13 = Goal(sheet_id=sheet_emp13.id, thrust_area="Customer Retention", title="Reduce implementation onboarding turnaround time from 14 to 9 days", uom_type="min", target="9", weightage=100)
        session.add(g_emp13)

        # --- SCENARIO D: Underweight Draft (emp14) ---
        # Under Sarah Jenkins (mgr3). Weightage total = 30% (< 100%).
        sheet_emp14 = GoalSheet(
            employee_id=users_db["emp14@company.com"].id,
            cycle_id=cyc_curr.id,
            status="draft"
        )
        session.add(sheet_emp14)
        await session.flush()
        
        g_emp14 = Goal(sheet_id=sheet_emp14.id, thrust_area="Customer Retention", title="Improve customer response SLA scores to 95%", uom_type="max", target="95", weightage=30)
        session.add(g_emp14)

        # --- SCENARIO E: Overweight Draft (emp17) ---
        # Under Marcus Aurelius (mgr4 - Disengaged). Weightage total = 120% (> 100%).
        sheet_emp17 = GoalSheet(
            employee_id=users_db["emp17@company.com"].id,
            cycle_id=cyc_curr.id,
            status="draft"
        )
        session.add(sheet_emp17)
        await session.flush()
        
        g_emp17_1 = Goal(sheet_id=sheet_emp17.id, thrust_area="Security & Compliance", title="Ensure zero critical vulnerabilities in quarterly VAPT audit", uom_type="zero", target="0", weightage=70)
        g_emp17_2 = Goal(sheet_id=sheet_emp17.id, thrust_area="Security & Compliance", title="Draft updated Disaster Recovery procedures", uom_type="timeline", target="100", weightage=50)
        session.add_all([g_emp17_1, g_emp17_2])

        # --- SCENARIO F: Stalled Approval (emp16) ---
        # Under Sarah Jenkins (mgr3). Submitted 6 days ago.
        sheet_emp16 = GoalSheet(
            employee_id=users_db["emp16@company.com"].id,
            cycle_id=cyc_curr.id,
            status="submitted",
            submitted_at=datetime.utcnow() - timedelta(days=6)
        )
        session.add(sheet_emp16)
        await session.flush()
        
        g_emp16 = Goal(sheet_id=sheet_emp16.id, thrust_area="Cost Optimization", title="Consolidate duplicate SaaS vendors to reduce expenditures", uom_type="max", target="100", weightage=100)
        session.add(g_emp16)

        # --- SCENARIO G: Manager Return/Rework Loop (emp18) ---
        # Under Marcus Aurelius (mgr4 - Disengaged). Returned to employee.
        sheet_emp18 = GoalSheet(
            employee_id=users_db["emp18@company.com"].id,
            cycle_id=cyc_curr.id,
            status="rework",
            submitted_at=datetime.utcnow() - timedelta(days=8)
        )
        session.add(sheet_emp18)
        await session.flush()
        
        g_emp18 = Goal(sheet_id=sheet_emp18.id, thrust_area="Security & Compliance", title="SOC2 Type II trust principles audit coordination", uom_type="timeline", target="120", weightage=100)
        session.add(g_emp18)
        await session.flush()
        
        chk_rework = CheckIn(
            sheet_id=sheet_emp18.id,
            manager_id=users_db["mgr4@company.com"].id,
            quarter="Goal Setting",
            comment="Please redefine compliance audit timeline target to 90 days instead of 120 days. Keep operations tightly mapped.",
            created_at=datetime.utcnow() - timedelta(days=7)
        )
        session.add(chk_rework)

        # --- SCENARIO H: Cross-Department Shared Goals & Admin Lock Overrides (emp8) ---
        # Under Elena Rostova (mgr2). Approved & Locked but Admin unlocked one goal.
        sheet_emp8 = GoalSheet(
            employee_id=users_db["emp8@company.com"].id,
            cycle_id=cyc_curr.id,
            status="approved",
            submitted_at=datetime.utcnow() - timedelta(days=20),
            approved_at=datetime.utcnow() - timedelta(days=19),
            approved_by=users_db["mgr2@company.com"].id
        )
        session.add(sheet_emp8)
        await session.flush()
        
        # Shared compliance goal pushed from mgr4 (CSCO)
        g_emp8_shared = Goal(
            sheet_id=sheet_emp8.id,
            thrust_area="Security & Compliance",
            title="SOC2 Compliance readiness",
            uom_type="timeline",
            target="100",
            weightage=40,
            is_locked=False # Unlocked by Admin!
        )
        g_emp8_custom = Goal(
            sheet_id=sheet_emp8.id,
            thrust_area="Product Delivery",
            title="Launch role-based analytics dashboard for enterprise admins",
            uom_type="max",
            target="100",
            weightage=60,
            is_locked=True
        )
        session.add_all([g_emp8_shared, g_emp8_custom])
        await session.flush()
        
        # Log the Admin lock override
        log_unlock = AuditLog(
            goal_id=g_emp8_shared.id,
            changed_by=users_db["admin@company.com"].id,
            field_name="is_locked",
            old_value="True",
            new_value="False",
            changed_at=datetime.utcnow() - timedelta(days=2)
        )
        session.add(log_unlock)

        # --- SCENARIO I: Cross-Department Shared Goals (emp11 and emp3) ---
        # Shared goal published by mgr5 (VP of RevOps) "Reduce sales cycle length from 45 to 32 days" (UoM: min, target: 32)
        sheet_mgr5 = GoalSheet(
            employee_id=users_db["mgr5@company.com"].id,
            cycle_id=cyc_curr.id,
            status="approved",
            submitted_at=datetime.utcnow() - timedelta(days=22),
            approved_at=datetime.utcnow() - timedelta(days=21),
            approved_by=users_db["admin@company.com"].id
        )
        session.add(sheet_mgr5)
        await session.flush()
        
        # Parent Goal
        g_shared_parent = Goal(
            sheet_id=sheet_mgr5.id,
            thrust_area="Revenue Growth",
            title="Reduce sales cycle length from 45 to 32 days",
            uom_type="min",
            target="32",
            weightage=50,
            is_locked=True
        )
        session.add(g_shared_parent)
        await session.flush()
        
        # Pushed to emp11 (RevOps Analyst) and emp3 (Engineering)
        sheet_emp11 = GoalSheet(
            employee_id=users_db["emp11@company.com"].id,
            cycle_id=cyc_curr.id,
            status="approved",
            submitted_at=datetime.utcnow() - timedelta(days=20),
            approved_at=datetime.utcnow() - timedelta(days=19),
            approved_by=users_db["mgr5@company.com"].id
        )
        sheet_emp3 = GoalSheet(
            employee_id=users_db["emp3@company.com"].id,
            cycle_id=cyc_curr.id,
            status="approved",
            submitted_at=datetime.utcnow() - timedelta(days=20),
            approved_at=datetime.utcnow() - timedelta(days=19),
            approved_by=users_db["mgr1@company.com"].id
        )
        session.add_all([sheet_emp11, sheet_emp3])
        await session.flush()
        
        # Child Goals
        g_child_11 = Goal(
            sheet_id=sheet_emp11.id,
            thrust_area="Revenue Growth",
            title="Reduce sales cycle length from 45 to 32 days",
            uom_type="min",
            target="32",
            weightage=50,
            shared_from=g_shared_parent.id,
            is_locked=True
        )
        g_child_3 = Goal(
            sheet_id=sheet_emp3.id,
            thrust_area="Revenue Growth",
            title="Reduce sales cycle length from 45 to 32 days",
            uom_type="min",
            target="32",
            weightage=40,
            shared_from=g_shared_parent.id,
            is_locked=True
        )
        # Add custom goals to hit 100%
        g_custom_11 = Goal(sheet_id=sheet_emp11.id, thrust_area="Revenue Growth", title="Increase RevOps pipeline visibility to 100%", uom_type="max", target="100", weightage=50, is_locked=True)
        g_custom_3 = Goal(sheet_id=sheet_emp3.id, thrust_area="Engineering", title="Deploy CRM real-time integrations", uom_type="timeline", target="100", weightage=60, is_locked=True)
        session.add_all([g_child_11, g_child_3, g_custom_11, g_custom_3])
        await session.flush()
        
        # Achievements for parent propagates automatically or matches
        a_parent = Achievement(goal_id=g_shared_parent.id, cycle_id=cyc_curr.id, quarter="Q1", actual="36", status="on_track", updated_at=datetime.utcnow() - timedelta(days=10))
        a_child_11 = Achievement(goal_id=g_child_11.id, cycle_id=cyc_curr.id, quarter="Q1", actual="36", status="on_track", updated_at=datetime.utcnow() - timedelta(days=10))
        a_child_3 = Achievement(goal_id=g_child_3.id, cycle_id=cyc_curr.id, quarter="Q1", actual="36", status="on_track", updated_at=datetime.utcnow() - timedelta(days=10))
        session.add_all([a_parent, a_child_11, a_child_3])

        # --- SCENARIO J: Outlier Performer with Late Q2/Missed Q2 (emp12) ---
        # VP David Chen (mgr5 - Detail-oriented). Missed Q2 update completely.
        sheet_emp12 = GoalSheet(
            employee_id=users_db["emp12@company.com"].id,
            cycle_id=cyc_curr.id,
            status="approved",
            submitted_at=datetime.utcnow() - timedelta(days=21),
            approved_at=datetime.utcnow() - timedelta(days=20),
            approved_by=users_db["mgr5@company.com"].id
        )
        session.add(sheet_emp12)
        await session.flush()
        
        g_emp12 = Goal(sheet_id=sheet_emp12.id, thrust_area="Revenue Growth", title="Increase billing systems reliability to 99.9%", uom_type="max", target="99.9", weightage=100, is_locked=True)
        session.add(g_emp12)
        await session.flush()
        
        # Log Q1 but completely omit Q2 (Late update edge case!)
        a_emp12_q1 = Achievement(goal_id=g_emp12.id, cycle_id=cyc_curr.id, quarter="Q1", actual="99.5", status="on_track", updated_at=datetime.utcnow() - timedelta(days=15))
        session.add(a_emp12_q1)

        # Commit all entities to DB
        await session.commit()
        print("Database committed. Generating high-fidelity JSON exports to docs/supabase_dump/...")

        # 10. Dump Database Tables to JSON for archives
        os.makedirs("docs/supabase_dump", exist_ok=True)
        
        tables = {
            "users": User,
            "departments": Department,
            "cycles": Cycle,
            "goal_sheets": GoalSheet,
            "goals": Goal,
            "achievements": Achievement,
            "checkins": CheckIn,
            "audit_logs": AuditLog
        }
        
        for name, model in tables.items():
            res = await session.execute(select(model))
            records = res.scalars().all()
            
            # Serialize each record
            serialized = []
            for r in records:
                # Build dict of columns
                d_record = {}
                for col in r.__table__.columns:
                    val = getattr(r, col.name)
                    if isinstance(val, (datetime, date)):
                        d_record[col.name] = val.isoformat()
                    elif isinstance(val, uuid.UUID):
                        d_record[col.name] = str(val)
                    else:
                        d_record[col.name] = val
                serialized.append(d_record)
                
            out_file = f"docs/supabase_dump/{name}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(serialized, f, indent=2, ensure_ascii=False)
            print(f"Dumped {len(serialized)} records into {out_file}")

        print("Comprehensive SaaS enterprise reseed and archive export completed successfully!")

if __name__ == "__main__":
    asyncio.run(async_main())
