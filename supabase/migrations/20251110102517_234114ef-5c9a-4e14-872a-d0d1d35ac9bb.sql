-- Add supervisor and manager roles to app_role enum if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('tenant_admin', 'supervisor', 'manager', 'user');
    ELSE
        -- Add new values if they don't exist
        BEGIN
            ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
            ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END;
    END IF;
END $$;

-- Add latitude and longitude to time_logs table for GPS tracking
ALTER TABLE time_logs 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add latitude and longitude to appointments table for job site locations
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create index on time_logs for finding active clock-ins
CREATE INDEX IF NOT EXISTS idx_time_logs_active ON time_logs(worker_id, clock_out) 
WHERE clock_out IS NULL;

-- Enable realtime for time_logs so supervisors see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE time_logs;