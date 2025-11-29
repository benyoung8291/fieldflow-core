-- Fix get_user_access_info to handle NULL customer_id properly
DROP FUNCTION IF EXISTS public.get_user_access_info();

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
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_has_role boolean;
  v_is_worker boolean;
  v_is_customer boolean;
  v_customer_id uuid;
  v_has_office_role boolean;
  v_has_customer_role boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if user has any role
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
  ) INTO v_has_role;
  
  -- Check if user is a worker
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
    SELECT customer_portal_users.customer_id 
    INTO v_customer_id
    FROM customer_portal_users
    WHERE customer_portal_users.user_id = v_user_id
    AND customer_portal_users.is_active = true
    LIMIT 1;
  END IF;
  
  -- Check if user has customer role
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
    AND user_roles.role = 'customer'::user_role
  ) INTO v_has_customer_role;
  
  -- Check if user has office roles (non-customer roles)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
    AND user_roles.role != 'customer'::user_role
  ) INTO v_has_office_role;
  
  -- CRITICAL SECURITY: If user is in customer_portal_users OR has customer role,
  -- they can ONLY access customer portal, even if they have other roles
  -- This prevents privilege escalation
  IF v_is_customer OR v_has_customer_role THEN
    -- Ensure we have a customer_id for customer portal users
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'Customer portal user missing customer_id';
    END IF;
    
    RETURN QUERY
    SELECT 
      v_user_id,
      v_has_role,
      false as is_worker,  -- Force false
      true as is_customer,
      v_customer_id,
      false as can_access_office,  -- Force false
      false as can_access_worker,  -- Force false
      true as can_access_customer_portal,
      false as show_toggle,  -- Force false
      '/customer'::text as default_route;
    RETURN;
  END IF;
  
  -- For non-customer users, return normal access
  RETURN QUERY
  SELECT 
    v_user_id,
    v_has_office_role OR v_is_worker as has_role,
    v_is_worker,
    false as is_customer,
    NULL::uuid as customer_id,
    v_has_office_role as can_access_office,
    v_is_worker as can_access_worker,
    false as can_access_customer_portal,
    (v_has_office_role AND v_is_worker) as show_toggle,
    CASE 
      WHEN v_has_office_role THEN '/dashboard'::text
      WHEN v_is_worker THEN '/worker/dashboard'::text
      ELSE '/auth'::text
    END as default_route;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_access_info() TO authenticated;