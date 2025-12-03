-- Fix profiles with missing tenant_id by setting them to the first tenant
-- This ensures all users have a valid tenant_id for RLS policies

UPDATE public.profiles p
SET tenant_id = (
  SELECT t.id 
  FROM public.tenants t 
  ORDER BY t.created_at ASC 
  LIMIT 1
)
WHERE p.tenant_id IS NULL;