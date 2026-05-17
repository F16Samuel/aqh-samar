import asyncio
import os
import sys

# Add the app directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import engine
from sqlalchemy import text

async def main():
    print("Executing schema migration steps individually...")
    
    commands = [
        # Create strict ENUM role type
        """DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_platform_role') THEN
                CREATE TYPE user_platform_role AS ENUM ('employee', 'manager', 'admin');
            END IF;
        END$$;""",
        
        # Add transition platform_role column (allowing NULL initially)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role user_platform_role;",
        
        # Add job_title and other corporate metadata columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);",
        
        # Backfill values from legacy role column
        """UPDATE users 
        SET platform_role = CASE 
            WHEN role = 'admin' THEN 'admin'::user_platform_role
            WHEN role = 'manager' THEN 'manager'::user_platform_role
            ELSE 'employee'::user_platform_role
        END
        WHERE platform_role IS NULL;""",
        
        # Enforce NOT NULL constraints on platform_role
        "ALTER TABLE users ALTER COLUMN platform_role SET NOT NULL;"
    ]
    
    async with engine.begin() as conn:
        for idx, cmd in enumerate(commands, 1):
            print(f"Executing step {idx}...")
            await conn.execute(text(cmd))
            
    print("Schema patch applied successfully!")

if __name__ == "__main__":
    asyncio.run(main())
