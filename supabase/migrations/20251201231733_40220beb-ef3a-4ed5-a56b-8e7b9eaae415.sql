-- Fix worker access security: exclude worker role from office access
-- and properly implement worker app isolation

CREATE OR REPLACE FUNCTION public.get_user_access_info()
RETURNS TABLE (
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
AS $$
DECLARE
  v_user_id uuid;
  v_has_role boolean;
  v_has_office_role boolean;
  v_has_worker_role boolean;
  v_is_worker boolean;
  v_is_customer boolean;
  v_customer_id uuid;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user has any role
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
  ) INTO v_has_role;

  -- Check if user has office access role (exclude customer AND worker)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
    AND user_roles.role NOT IN ('customer'::user_role, 'worker'::user_role)
  ) INTO v_has_office_role;

  -- Check if user has worker role explicitly
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
    AND user_roles.role = 'worker'::user_role
  ) INTO v_has_worker_role;

  -- Check if user exists in workers table
  SELECT EXISTS (
    SELECT 1 FROM workers
    WHERE workers.id = v_user_id
  ) INTO v_is_worker;

  -- Check if user is a customer portal user
  SELECT EXISTS (
    SELECT 1 FROM customer_portal_users
    WHERE customer_portal_users.user_id = v_user_id
    AND customer_portal_users.is_active = true
  ) INTO v_is_customer;

  -- Get customer_id if user is a customer
  IF v_is_customer THEN
    SELECT customer_portal_users.customer_id INTO v_customer_id
    FROM customer_portal_users
    WHERE customer_portal_users.user_id = v_user_id
    LIMIT 1;
  END IF;

  -- Return the access information
  RETURN QUERY SELECT
    v_user_id,
    v_has_role,
    v_is_worker,
    v_is_customer,
    v_customer_id,
    v_has_office_role as can_access_office,
    (v_is_worker OR v_has_worker_role) as can_access_worker,
    v_is_customer as can_access_customer_portal,
    (v_has_office_role AND (v_is_worker OR v_has_worker_role)) as show_toggle,
    CASE 
      WHEN v_has_office_role THEN '/dashboard'::text
      WHEN v_is_worker OR v_has_worker_role THEN '/worker/dashboard'::text
      WHEN v_is_customer THEN '/customer-portal'::text
      ELSE '/auth'::text
    END as default_route;
END;
$$;