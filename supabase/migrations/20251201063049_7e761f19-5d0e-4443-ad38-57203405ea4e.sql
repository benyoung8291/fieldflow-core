-- Drop the duplicate function with parameters in wrong order
-- Keep the version with tenant_id first as that's the standard pattern
DROP FUNCTION IF EXISTS public.generate_service_orders_from_contracts(p_start_date date, p_end_date date, p_tenant_id uuid, p_user_id uuid);

-- The correct function with tenant_id first will remain:
-- public.generate_service_orders_from_contracts(p_tenant_id uuid, p_start_date date, p_end_date date, p_user_id uuid)