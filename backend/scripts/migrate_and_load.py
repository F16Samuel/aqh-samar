import asyncio
import os
import sys
import json
from datetime import date, datetime
import uuid
import random

# Add parent directory to sys.path to resolve 'app' imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from supabase import create_client, Client
from sqlalchemy import select, text
from app.core.config import settings
from app.db.session import engine, AsyncSessionLocal
import app.db.base_all

from app.models.department import Department
from app.models.user import User
from app.models.cycle import Cycle
from app.models.goal import GoalSheet, Goal, Achievement, CheckIn, AuditLog

async def async_main():
    print("=== Supabase Data Migration & Loading Script ===")
    
    # 1. Back up current database tables to docs/supabase_dump_v3/
    backup_dir = "docs/supabase_dump_v3"
    print(f"Starting backup of current database to {backup_dir}...")
    os.makedirs(backup_dir, exist_ok=True)
    
    tables_to_backup = {
        "users": User,
        "departments": Department,
        "cycles": Cycle,
        "goal_sheets": GoalSheet,
        "goals": Goal,
        "achievements": Achievement,
        "checkins": CheckIn,
        "audit_logs": AuditLog
    }
    
    async with AsyncSessionLocal() as session:
        for name, model in tables_to_backup.items():
            try:
                res = await session.execute(select(model))
                records = res.scalars().all()
                
                serialized = []
                for r in records:
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
                    
                out_path = os.path.join(backup_dir, f"{name}.json")
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(serialized, f, indent=2, ensure_ascii=False)
                print(f"  Backed up {len(serialized)} records into {out_path}")
            except Exception as e:
                print(f"  Warning during backup of {name}: {e}")
                
    print("Backup completed successfully.\n")
    
    # 2. Wipe Supabase Auth users
    print("Wiping Supabase Auth users...")
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    auth_users = []
    try:
        res = supabase.auth.admin.list_users()
        auth_users = res if isinstance(res, list) else getattr(res, 'users', [])
    except Exception as e:
        print(f"Error listing auth users: {e}")
        
    print(f"Found {len(auth_users)} auth users. Deleting...")
    for u in auth_users:
        try:
            supabase.auth.admin.delete_user(u.id)
        except Exception as e:
            print(f"Failed to delete auth user {u.email}: {e}")
    print("Auth users wiped successfully.\n")
    
    # 3. Wipe Public Schema tables in cascaded order using TRUNCATE
    print("Wiping existing records from public schema tables...")
    async with engine.begin() as conn:
        # TRUNCATE CASCADE completely empties tables while keeping schema definitions and Alembic versions intact
        await conn.execute(text(
            "TRUNCATE TABLE audit_logs, checkins, achievements, goals, goal_sheets, users, cycles, departments CASCADE;"
        ))
    print("Existing public records wiped cleanly.\n")
    
    # 4. Load & migrate data from docs/supabase_dump/
    src_dir = "docs/supabase_dump"
    print(f"Loading data files from source directory: {src_dir}...")
    
    # Read files
    with open(os.path.join(src_dir, "departments.json"), "r", encoding="utf-8") as f:
        src_departments = json.load(f)
    with open(os.path.join(src_dir, "cycles.json"), "r", encoding="utf-8") as f:
        src_cycles = json.load(f)
    with open(os.path.join(src_dir, "users.json"), "r", encoding="utf-8") as f:
        src_users = json.load(f)
    with open(os.path.join(src_dir, "goal_sheets.json"), "r", encoding="utf-8") as f:
        src_goal_sheets = json.load(f)
    with open(os.path.join(src_dir, "goals.json"), "r", encoding="utf-8") as f:
        src_goals = json.load(f)
    with open(os.path.join(src_dir, "achievements.json"), "r", encoding="utf-8") as f:
        src_achievements = json.load(f)
    with open(os.path.join(src_dir, "checkins.json"), "r", encoding="utf-8") as f:
        src_checkins = json.load(f)
    with open(os.path.join(src_dir, "audit_logs.json"), "r", encoding="utf-8") as f:
        src_audit_logs = json.load(f)
        
    user_mapping = {} # maps old user UUID -> new user UUID
    
    async with AsyncSessionLocal() as session:
        # A. Insert Departments
        print("Inserting departments...")
        for dept in src_departments:
            d = Department(
                id=uuid.UUID(dept["id"]),
                name=dept["name"]
            )
            session.add(d)
        await session.flush()
        print(f"  Inserted {len(src_departments)} departments.")
        
        # B. Insert Cycles
        print("Inserting cycles...")
        for cyc in src_cycles:
            c = Cycle(
                id=uuid.UUID(cyc["id"]),
                year=cyc["year"],
                phase=cyc["phase"],
                window_open=date.fromisoformat(cyc["window_open"]),
                window_close=date.fromisoformat(cyc["window_close"]),
                is_active=cyc["is_active"]
            )
            session.add(c)
        await session.flush()
        print(f"  Inserted {len(src_cycles)} cycles.")
        
        # C. Insert Users
        print("Inserting users and syncing Supabase Auth profiles...")
        
        # Define high-fidelity corporate metadata mapping to populate missing columns in old dump
        job_titles = {
            "admin@company.com": "Head of People Operations",
            "mgr1@company.com": "Engineering Director",
            "mgr2@company.com": "Sales Director",
            "mgr3@company.com": "Marketing Director",
            "mgr4@company.com": "Product Director",
            "emp1@company.com": "Senior Frontend Engineer",
            "emp2@company.com": "Senior Backend Engineer",
            "emp3@company.com": "Enterprise Account Executive",
            "emp4@company.com": "Account Executive",
            "emp5@company.com": "SEO Marketing Specialist",
            "emp6@company.com": "Technical Content Writer",
            "emp7@company.com": "Product UI/UX Designer",
            "emp8@company.com": "Lead Product Owner",
            "emp_stuck@company.com": "Customer Success Specialist",
            "emp_new@company.com": "Junior Full-Stack Engineer"
        }
        
        user_list_db = []
        for user_data in src_users:
            email = user_data["email"]
            old_id = user_data["id"]
            
            # Create user profile in Supabase Auth
            new_uid = None
            try:
                # Attempt to create with same exact UUID to preserve database history 100%
                res = supabase.auth.admin.create_user({
                    "id": old_id,
                    "email": email,
                    "password": "password123",
                    "email_confirm": True
                })
                new_uid = uuid.UUID(res.user.id)
            except Exception as e:
                # Fallback to auto-generated UID in Auth
                try:
                    res = supabase.auth.admin.create_user({
                        "email": email,
                        "password": "password123",
                        "email_confirm": True
                    })
                    new_uid = uuid.UUID(res.user.id)
                except Exception as inner_e:
                    print(f"    Failed creating auth user {email}: {inner_e}")
                    new_uid = uuid.UUID(old_id) # Last resort: use local UUID as fallback
                    
            user_mapping[old_id] = new_uid
            
            # Stagger office location based on department or email
            if "mgr1" in email or "emp1" in email or "emp2" in email or "emp_new" in email:
                location = "NYC Office"
            elif "mgr2" in email or "emp3" in email or "emp4" in email or "emp_stuck" in email:
                location = "SF Office"
            else:
                location = "Remote"
                
            u = User(
                id=new_uid,
                email=email,
                full_name=user_data["full_name"],
                role=user_data["role"],
                platform_role=user_data["role"],
                job_title=job_titles.get(email, "Performance Associate"),
                department_id=uuid.UUID(user_data["department_id"]) if user_data["department_id"] else None,
                is_active=True,
                employment_type="Full-time",
                employee_code=f"EMP-10{random.randint(100, 999)}",
                location=location,
                created_at=datetime.fromisoformat(user_data["created_at"])
            )
            session.add(u)
            user_list_db.append((u, user_data.get("manager_id")))
            
        await session.flush()
        print(f"  Inserted {len(src_users)} users.")
        
        # Link manager hierarchical relations using the mapped new UUIDs
        print("Restoring reporting hierarchy links...")
        linked_count = 0
        for user_obj, old_mgr_id in user_list_db:
            if old_mgr_id:
                mapped_mgr_id = user_mapping.get(old_mgr_id)
                if mapped_mgr_id:
                    user_obj.manager_id = mapped_mgr_id
                    linked_count += 1
        await session.flush()
        print(f"  Hierarchical links updated for {linked_count} users.")
        
        # D. Insert Goal Sheets
        print("Inserting goal sheets...")
        for gs in src_goal_sheets:
            sheet_id = uuid.UUID(gs["id"])
            emp_id = uuid.UUID(gs["employee_id"])
            mapped_emp_id = user_mapping.get(str(emp_id)) or user_mapping.get(gs["employee_id"])
            
            approved_by = gs.get("approved_by")
            mapped_approved_by = None
            if approved_by:
                mapped_approved_by = user_mapping.get(str(approved_by)) or user_mapping.get(approved_by)
                
            submitted_at = gs.get("submitted_at")
            if submitted_at:
                submitted_at = datetime.fromisoformat(submitted_at)
            approved_at = gs.get("approved_at")
            if approved_at:
                approved_at = datetime.fromisoformat(approved_at)
                
            s = GoalSheet(
                id=sheet_id,
                employee_id=mapped_emp_id,
                cycle_id=uuid.UUID(gs["cycle_id"]),
                status=gs["status"],
                submitted_at=submitted_at,
                approved_at=approved_at,
                approved_by=mapped_approved_by
            )
            session.add(s)
        await session.flush()
        print(f"  Inserted {len(src_goal_sheets)} goal sheets.")
        
        # E. Insert Goals
        print("Inserting goals...")
        for gl in src_goals:
            g = Goal(
                id=uuid.UUID(gl["id"]),
                sheet_id=uuid.UUID(gl["sheet_id"]),
                thrust_area=gl["thrust_area"],
                title=gl["title"],
                description=gl.get("description"),
                uom_type=gl["uom_type"],
                target=gl["target"],
                weightage=gl["weightage"],
                is_locked=gl["is_locked"],
                shared_from=uuid.UUID(gl["shared_from"]) if gl.get("shared_from") else None
            )
            session.add(g)
        await session.flush()
        print(f"  Inserted {len(src_goals)} goals.")
        
        # F. Insert Achievements
        print("Inserting achievements...")
        for ach in src_achievements:
            a = Achievement(
                id=uuid.UUID(ach["id"]),
                goal_id=uuid.UUID(ach["goal_id"]),
                cycle_id=uuid.UUID(ach["cycle_id"]),
                quarter=ach["quarter"],
                actual=ach["actual"],
                status=ach["status"],
                updated_at=datetime.fromisoformat(ach["updated_at"])
            )
            session.add(a)
        await session.flush()
        print(f"  Inserted {len(src_achievements)} achievements.")
        
        # G. Insert Check-ins
        print("Inserting manager check-ins...")
        for chk in src_checkins:
            mgr_id = uuid.UUID(chk["manager_id"])
            mapped_mgr_id = user_mapping.get(str(mgr_id)) or user_mapping.get(chk["manager_id"])
            
            c = CheckIn(
                id=uuid.UUID(chk["id"]),
                sheet_id=uuid.UUID(chk["sheet_id"]),
                manager_id=mapped_mgr_id,
                quarter=chk["quarter"],
                comment=chk["comment"],
                created_at=datetime.fromisoformat(chk["created_at"])
            )
            session.add(c)
        await session.flush()
        print(f"  Inserted {len(src_checkins)} manager check-ins.")
        
        # H. Insert Audit Logs
        print("Inserting audit logs...")
        for al in src_audit_logs:
            changer_id = uuid.UUID(al["changed_by"])
            mapped_changer_id = user_mapping.get(str(changer_id)) or user_mapping.get(al["changed_by"])
            
            log = AuditLog(
                id=uuid.UUID(al["id"]),
                goal_id=uuid.UUID(al["goal_id"]),
                changed_by=mapped_changer_id,
                field_name=al["field_name"],
                old_value=al["old_value"],
                new_value=al["new_value"],
                changed_at=datetime.fromisoformat(al["changed_at"])
            )
            session.add(log)
            
        await session.commit()
        print("=== Database Migration Committed Successfully! ===")
        print("Data restoration from docs/supabase_dump completed successfully.")

if __name__ == "__main__":
    asyncio.run(async_main())
