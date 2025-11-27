-- CRITICAL SECURITY FIX: Restrict customer portal users to only customer portal access

-- First, update the get_user_access_info function to properly handle customer users
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
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_has_role boolean;
  v_is_worker boolean;
  v_is_customer boolean;
  v_customer_id uuid;
  v_has_office_role boolean;
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
  
  -- Check if user has office roles (non-customer roles)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
    AND user_roles.role != 'customer'
  ) INTO v_has_office_role;
  
  -- Return the results
  RETURN QUERY
  SELECT 
    v_user_id,
    v_has_role,
    v_is_worker,
    v_is_customer,
    v_customer_id,
    v_has_office_role as can_access_office,
    v_is_worker as can_access_worker,
    v_is_customer as can_access_customer_portal,
    (v_has_office_role AND v_is_worker) as show_toggle,
    CASE 
      WHEN v_is_customer THEN '/customer'::text
      WHEN v_has_office_role THEN '/dashboard'::text
      WHEN v_is_worker THEN '/worker/dashboard'::text
      ELSE '/auth'::text
    END as default_route;
END;
$$;

-- Add RLS policies for customer_portal_users table
ALTER TABLE customer_portal_users ENABLE ROW LEVEL SECURITY;

-- Customer portal users can view their own record
CREATE POLICY "Customer portal users can view own record"
ON customer_portal_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only tenant admins and super admins can manage customer portal users
CREATE POLICY "Admins can manage customer portal users"
ON customer_portal_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('tenant_admin', 'super_admin')
  )
);

-- Add RLS policies for customer_portal_settings
ALTER TABLE customer_portal_settings ENABLE ROW LEVEL SECURITY;

-- Customer portal users can view settings for their customer
CREATE POLICY "Customer portal users can view their customer settings"
ON customer_portal_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users
    WHERE customer_portal_users.user_id = auth.uid()
    AND customer_portal_users.customer_id = customer_portal_settings.customer_id
    AND customer_portal_users.is_active = true
  )
);

-- Only tenant admins can manage customer portal settings
CREATE POLICY "Admins can manage customer portal settings"
ON customer_portal_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('tenant_admin', 'super_admin')
  )
);

-- Add RLS policy for customers table - customer portal users can only view their own customer
CREATE POLICY "Customer portal users can view their own customer"
ON customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users
    WHERE customer_portal_users.user_id = auth.uid()
    AND customer_portal_users.customer_id = customers.id
    AND customer_portal_users.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('tenant_admin', 'super_admin', 'management', 'supervisor', 'worker', 'accountant')
  )
);

-- Add RLS policy for customer_locations - customer portal users can only view their customer's locations
CREATE POLICY "Customer portal users can view their customer locations"
ON customer_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users
    WHERE customer_portal_users.user_id = auth.uid()
    AND customer_portal_users.customer_id = customer_locations.customer_id
    AND customer_portal_users.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('tenant_admin', 'super_admin', 'management', 'supervisor', 'worker', 'accountant')
  )
);