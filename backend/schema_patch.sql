-- ====================================================================
-- SCHEMA MIGRATION PATCH: platform_role & job_title SEPARATION
-- ====================================================================
-- Preserves legacy 'role' column for complete backward compatibility.
-- Integrates strict user_platform_role ENUM constraints in Postgres.

-- 1. Create platform_role ENUM if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_platform_role') THEN
        CREATE TYPE user_platform_role AS ENUM ('employee', 'manager', 'admin');
    END IF;
END$$;

-- 2. Alter users table to add new structural and metadata columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role user_platform_role NOT NULL DEFAULT 'employee';
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255) NULL;

-- 3. Backfill values from legacy 'role' column to 'platform_role'
UPDATE users SET platform_role = 'admin' WHERE role = 'admin';
UPDATE users SET platform_role = 'manager' WHERE role = 'manager';
UPDATE users SET platform_role = 'employee' WHERE role = 'employee';

-- 4. Sync metadata values for existing profiles where applicable
UPDATE users SET job_title = 'System Administrator' WHERE role = 'admin' AND job_title IS NULL;
UPDATE users SET job_title = 'Team Lead' WHERE role = 'manager' AND job_title IS NULL;
UPDATE users SET job_title = 'Individual Contributor' WHERE role = 'employee' AND job_title IS NULL;

-- 5. Alter goal_sheets table to add HR/Manager creation intervention metadata columns
ALTER TABLE goal_sheets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE goal_sheets ADD COLUMN IF NOT EXISTS creation_reason VARCHAR(255) NULL;
