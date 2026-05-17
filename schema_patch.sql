-- Step 1: Create the strict PostgreSQL ENUM type for platform roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_platform_role') THEN
        CREATE TYPE user_platform_role AS ENUM ('employee', 'manager', 'admin');
    END IF;
END$$;

-- Step 2: Add platform_role column (allowing NULL initially for safe transition)
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role user_platform_role;

-- Step 3: Add job_title and other corporate metadata columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Step 4: Backfill platform_role from role
UPDATE users 
SET platform_role = CASE 
    WHEN role = 'admin' THEN 'admin'::user_platform_role
    WHEN role = 'manager' THEN 'manager'::user_platform_role
    ELSE 'employee'::user_platform_role
END
WHERE platform_role IS NULL;

-- Step 5: Enforce NOT NULL constraint on platform_role
ALTER TABLE users ALTER COLUMN platform_role SET NOT NULL;

-- Note: We will temporarily retain the legacy 'role' column during the transition phase.
-- Once the software layers are verified, 'role' can be safely dropped in a final cleanup step.
