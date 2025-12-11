-- Fix the security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true)
AS
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

-- Re-grant access
GRANT SELECT ON public.profiles_safe TO authenticated;

COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles excluding sensitive payroll fields. Uses security_invoker to enforce RLS of the querying user.';