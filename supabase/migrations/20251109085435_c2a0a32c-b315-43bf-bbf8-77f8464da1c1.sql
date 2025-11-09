-- Recreate workers view as SECURITY INVOKER (not SECURITY DEFINER)
DROP VIEW IF EXISTS workers;

CREATE VIEW workers 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.tenant_id,
  p.is_active,
  p.pay_rate_category_id,
  p.preferred_start_time,
  p.preferred_end_time,
  p.preferred_days,
  p.created_at,
  p.updated_at
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.id 
  AND ur.role IN ('worker', 'supervisor', 'tenant_admin')
);