-- Create a safe view that excludes sensitive payroll columns
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  id,
  tenant_id,
  first_name,
  last_name,
  phone,
  avatar_url,
  created_at,
  updated_at,
  emergency_contact_name,
  emergency_contact_phone,
  pay_rate_category_id,
  preferred_days,
  preferred_start_time,
  preferred_end_time,
  is_active,
  email,
  service_orders_enabled,
  projects_enabled,
  default_pipeline_id,
  default_stage_id,
  theme_preference,
  task_view_preference,
  task_kanban_mode,
  standard_work_hours,
  employment_type,
  status,
  status_updated_at,
  auto_away_minutes,
  customer_id,
  state,
  worker_state,
  worker_phone,
  needs_password_reset,
  email_signature
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Drop the overly permissive policy that exposes all columns to all tenant users
DROP POLICY IF EXISTS "Users can view tenant profiles" ON public.profiles;

-- Create a new restrictive policy: users can only view their own profile for sensitive data
-- (Admins already have access via "Admins can manage tenant profiles" policy)
CREATE POLICY "Users can view own profile data"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Add comment explaining the security model
COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles excluding sensitive payroll fields (tax_file_number, abn, super_fund_name, super_fund_number). Use this for general profile lookups. Direct profiles table access is restricted to own profile or admin roles.';