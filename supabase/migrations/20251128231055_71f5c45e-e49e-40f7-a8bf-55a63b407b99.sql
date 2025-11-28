-- CRITICAL SECURITY FIX: Prevent customer portal users from accessing the full app
-- This ensures customer portal users can ONLY access customer portal, even if they have multiple roles

-- Drop and recreate get_user_access_info with stricter logic
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
    AND user_roles.role::text = 'customer'
  ) INTO v_has_customer_role;
  
  -- Check if user has office roles (non-customer roles)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = v_user_id
    AND user_roles.role::text != 'customer'
  ) INTO v_has_office_role;
  
  -- CRITICAL SECURITY: If user is in customer_portal_users OR has customer role,
  -- they can ONLY access customer portal, even if they have other roles
  -- This prevents privilege escalation
  IF v_is_customer OR v_has_customer_role THEN
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
    v_has_role,
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

-- Add constraint to prevent users from having both customer and non-customer roles
-- First, create a function to check role conflicts
CREATE OR REPLACE FUNCTION check_customer_role_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If adding a customer role, check if user has other roles
  IF NEW.role::text = 'customer' THEN
    IF EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = NEW.user_id
      AND role::text != 'customer'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Customer portal users cannot have additional roles';
    END IF;
  ELSE
    -- If adding a non-customer role, check if user has customer role
    IF EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = NEW.user_id
      AND role::text = 'customer'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Users with office roles cannot be customer portal users';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce the constraint
DROP TRIGGER IF EXISTS prevent_customer_role_conflict ON user_roles;
CREATE TRIGGER prevent_customer_role_conflict
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION check_customer_role_conflict();

-- Clean up any existing conflicts (remove non-customer roles from customer portal users)
DELETE FROM user_roles
WHERE user_id IN (
  SELECT DISTINCT ur.user_id
  FROM user_roles ur
  INNER JOIN customer_portal_users cpu ON ur.user_id = cpu.user_id
  WHERE ur.role::text != 'customer'
  AND cpu.is_active = true
);

-- Ensure all active customer portal users have the customer role
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT 
  cpu.user_id,
  'customer' as role,
  cpu.tenant_id
FROM customer_portal_users cpu
WHERE cpu.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = cpu.user_id
  AND ur.role::text = 'customer'
)
ON CONFLICT DO NOTHING;