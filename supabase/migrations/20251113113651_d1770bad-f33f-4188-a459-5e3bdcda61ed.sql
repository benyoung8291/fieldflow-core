-- Add standard work hours to profiles table for worker utilization tracking
ALTER TABLE profiles
ADD COLUMN standard_work_hours numeric DEFAULT 40 CHECK (standard_work_hours >= 0 AND standard_work_hours <= 168),
ADD COLUMN employment_type text DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'casual'));

-- Add comment for documentation
COMMENT ON COLUMN profiles.standard_work_hours IS 'Expected work hours per week for utilization calculations';
COMMENT ON COLUMN profiles.employment_type IS 'Employment type: full_time (40h), part_time (variable), contractor, or casual';