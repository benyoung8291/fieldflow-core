
CREATE OR REPLACE FUNCTION public.get_user_access_info()
RETURNS TABLE(
  user_id uuid,
  has_role boolean,
  is_worker boolean,
  is_customer boolean,
  customer_id uuid,
  can_access_office boolean,
  can_access_worker boolean,
  can_access_customer_portal boolean,
  show_toggle boolean,
  default_route text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_has_role boolean := false;
  v_is_worker boolean := false;
  v_is_customer boolean := false;
  v_customer_id uuid;
  v_has_office_role boolean := false;
  v_has_worker_role boolean := false;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get tenant_id from profiles
  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p
  WHERE p.id = v_user_id;

  -- Check if user has any role in user_roles
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = v_user_id
  ) INTO v_has_role;

  -- Check if user has office-level roles (not customer, not worker)
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = v_user_id 
    AND ur.role NOT IN ('customer', 'worker')
  ) INTO v_has_office_role;

  -- Check if user has worker role specifically
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = v_user_id 
    AND ur.role = 'worker'
  ) INTO v_has_worker_role;

  -- Check if user is a worker (has worker role or exists in workers table)
  v_is_worker := v_has_worker_role OR EXISTS (
    SELECT 1 FROM workers w 
    WHERE w.id = v_user_id
  );

  -- Check if user is a customer portal user
  SELECT cpu.customer_id INTO v_customer_id
  FROM customer_portal_users cpu
  WHERE cpu.user_id = v_user_id
  AND cpu.is_active = true
  LIMIT 1;

  v_is_customer := v_customer_id IS NOT NULL;

  RETURN QUERY SELECT
    v_user_id as user_id,
    v_has_role as has_role,
    v_is_worker as is_worker,
    v_is_customer as is_customer,
    v_customer_id as customer_id,
    v_has_office_role as can_access_office,
    (v_is_worker OR v_has_worker_role) as can_access_worker,
    v_is_customer as can_access_customer_portal,
    (v_has_office_role AND (v_is_worker OR v_has_worker_role)) as show_toggle,
    CASE 
      WHEN v_has_office_role THEN '/dashboard'::text
      WHEN v_is_worker OR v_has_worker_role THEN '/worker/dashboard'::text
      WHEN v_is_customer THEN '/customer'::text
      ELSE '/auth'::text
    END as default_route;
END;
$function$;
