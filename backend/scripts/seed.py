import asyncio
import os
import sys
from datetime import date, datetime

# Add the app directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from supabase import create_client, Client
from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.department import Department
from app.models.user import User
from app.models.cycle import Cycle
import app.db.base_all  # Ensure all models are registered

async def main():
    print("Starting seed script...")
    
    # Initialize Supabase client with service role key to bypass auth rules
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    
    async with AsyncSessionLocal() as session:
        # 1. Create Departments
        depts = ["Engineering", "Sales", "Human Resources", "Marketing"]
        dept_map = {}
        for d_name in depts:
            result = await session.execute(select(Department).where(Department.name == d_name))
            dept = result.scalar_one_or_none()
            if not dept:
                dept = Department(name=d_name)
                session.add(dept)
                await session.flush()
                print(f"Created department: {d_name}")
            dept_map[d_name] = dept.id
            
        # 2. Create Active Cycle
        cycle_result = await session.execute(select(Cycle).where(Cycle.is_active == True))
        cycle = cycle_result.scalar_one_or_none()
        if not cycle:
            cycle = Cycle(
                year=date.today().year,
                phase="Phase 1 - Goal Setting",
                window_open=date(date.today().year, 1, 1),
                window_close=date(date.today().year, 12, 31),
                is_active=True
            )
            session.add(cycle)
            await session.flush()
            print("Created active cycle")
            
        # 3. Create Users
        users_data = [
            {"email": "admin@company.com", "name": "System Admin", "role": "admin", "dept": "Human Resources", "manager_email": None},
            {"email": "mgr1@company.com", "name": "Engineering Manager", "role": "manager", "dept": "Engineering", "manager_email": None},
            {"email": "mgr2@company.com", "name": "Sales Manager", "role": "manager", "dept": "Sales", "manager_email": None},
            {"email": "emp1@company.com", "name": "Frontend Developer", "role": "employee", "dept": "Engineering", "manager_email": "mgr1@company.com"},
            {"email": "emp2@company.com", "name": "Backend Developer", "role": "employee", "dept": "Engineering", "manager_email": "mgr1@company.com"},
            {"email": "emp3@company.com", "name": "Sales Rep 1", "role": "employee", "dept": "Sales", "manager_email": "mgr2@company.com"},
            {"email": "emp4@company.com", "name": "Sales Rep 2", "role": "employee", "dept": "Sales", "manager_email": "mgr2@company.com"},
        ]
        
        user_id_map = {}
        
        for ud in users_data:
            email = ud["email"]
            # Check if user already exists in DB
            result = await session.execute(select(User).where(User.email == email))
            db_user = result.scalar_one_or_none()
            
            if not db_user:
                # 1. Create in Supabase Auth
                try:
                    # Check if user exists in Supabase first (to handle partial seeds)
                    sb_user = None
                    try:
                        # Attempt to create
                        res = supabase.auth.admin.create_user({
                            "email": email,
                            "password": "password123",
                            "email_confirm": True
                        })
                        sb_user_id = res.user.id
                        print(f"Created user in Supabase Auth: {email}")
                    except Exception as e:
                        print(f"User {email} might already exist in Supabase Auth: {e}")
                        # If exists, we can't easily get the ID without listing users.
                        # Assuming empty DB, this should succeed. If it fails, we will skip.
                        users = supabase.auth.admin.list_users()
                        for u in users:
                            if u.email == email:
                                sb_user_id = u.id
                                break
                        else:
                            print(f"Could not find existing Supabase auth user for {email}")
                            continue

                    # 2. Create in Public DB with same ID
                    db_user = User(
                        id=sb_user_id,
                        email=email,
                        full_name=ud["name"],
                        role=ud["role"],
                        department_id=dept_map[ud["dept"]]
                    )
                    session.add(db_user)
                    await session.flush()
                    print(f"Created user in public DB: {email}")
                except Exception as e:
                    print(f"Error creating user {email}: {e}")
                    continue
            else:
                print(f"User already exists in DB: {email}")
                
            user_id_map[email] = db_user.id
            
        # 4. Set Managers
        for ud in users_data:
            if ud["manager_email"]:
                email = ud["email"]
                manager_email = ud["manager_email"]
                
                result = await session.execute(select(User).where(User.email == email))
                db_user = result.scalar_one()
                
                result_mgr = await session.execute(select(User).where(User.email == manager_email))
                db_mgr = result_mgr.scalar_one()
                
                if db_user.manager_id != db_mgr.id:
                    db_user.manager_id = db_mgr.id
                    print(f"Set manager for {email} to {manager_email}")
                    
        await session.commit()
        print("Seed script completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
