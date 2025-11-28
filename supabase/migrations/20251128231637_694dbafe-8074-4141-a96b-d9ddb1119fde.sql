-- Add customer portal user roles with three permission levels
-- Full Portal User: All access including financial data
-- Supervisor User: Create requests, markup floor plans, view past requests and field reports
-- Basic User: Only create requests and markup floor plans

-- Create enum for customer portal user roles
CREATE TYPE customer_portal_role AS ENUM ('full_access', 'supervisor', 'basic');

-- Add role column to customer_portal_users
ALTER TABLE customer_portal_users 
ADD COLUMN portal_role customer_portal_role NOT NULL DEFAULT 'basic';

-- Create index for performance
CREATE INDEX idx_customer_portal_users_role ON customer_portal_users(portal_role);

-- Create a function to check customer portal user permissions
CREATE OR REPLACE FUNCTION public.has_customer_portal_permission(
  p_user_id uuid,
  p_permission_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal_role customer_portal_role;
BEGIN
  -- Get user's portal role
  SELECT portal_role INTO v_portal_role
  FROM customer_portal_users
  WHERE user_id = p_user_id
  AND is_active = true;
  
  IF v_portal_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check permissions based on role
  CASE p_permission_type
    -- Basic permissions (all roles)
    WHEN 'create_request' THEN
      RETURN true;
    WHEN 'markup_floor_plan' THEN
      RETURN true;
    
    -- Supervisor permissions (supervisor + full_access)
    WHEN 'view_service_orders' THEN
      RETURN v_portal_role IN ('supervisor', 'full_access');
    WHEN 'view_field_reports' THEN
      RETURN v_portal_role IN ('supervisor', 'full_access');
    WHEN 'view_appointments' THEN
      RETURN v_portal_role IN ('supervisor', 'full_access');
    
    -- Full access permissions (only full_access)
    WHEN 'view_financial' THEN
      RETURN v_portal_role = 'full_access';
    WHEN 'view_invoices' THEN
      RETURN v_portal_role = 'full_access';
    WHEN 'view_contracts' THEN
      RETURN v_portal_role = 'full_access';
    
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Update RLS policies for customer portal features based on roles

-- Service orders - supervisor and full access only
DROP POLICY IF EXISTS "Customer portal users can view their service orders" ON service_orders;
CREATE POLICY "Customer portal users can view their service orders"
ON service_orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    WHERE cpu.user_id = auth.uid()
    AND cpu.customer_id = service_orders.customer_id
    AND cpu.is_active = true
    AND cpu.portal_role IN ('supervisor', 'full_access')
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role::text IN ('tenant_admin', 'super_admin', 'management', 'supervisor', 'worker')
  )
);

-- Field reports - supervisor and full access only
DROP POLICY IF EXISTS "Customer portal users can view their field reports" ON field_reports;
CREATE POLICY "Customer portal users can view their field reports"
ON field_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    INNER JOIN service_orders so ON so.customer_id = cpu.customer_id
    WHERE cpu.user_id = auth.uid()
    AND field_reports.service_order_id = so.id
    AND cpu.is_active = true
    AND cpu.portal_role IN ('supervisor', 'full_access')
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role::text IN ('tenant_admin', 'super_admin', 'management', 'supervisor', 'worker')
  )
);

-- Invoices - full access only
DROP POLICY IF EXISTS "Customer portal users can view their invoices" ON invoices;
CREATE POLICY "Customer portal users can view their invoices"
ON invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    WHERE cpu.user_id = auth.uid()
    AND cpu.customer_id = invoices.customer_id
    AND cpu.is_active = true
    AND cpu.portal_role = 'full_access'
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role::text IN ('tenant_admin', 'super_admin', 'management', 'accountant')
  )
);

-- Service contracts - full access only
DROP POLICY IF EXISTS "Customer portal users can view their contracts" ON service_contracts;
CREATE POLICY "Customer portal users can view their contracts"
ON service_contracts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    WHERE cpu.user_id = auth.uid()
    AND cpu.customer_id = service_contracts.customer_id
    AND cpu.is_active = true
    AND cpu.portal_role = 'full_access'
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role::text IN ('tenant_admin', 'super_admin', 'management')
  )
);

-- Location floor plans - all customer portal users can view and markup
DROP POLICY IF EXISTS "Customer portal users can view floor plans" ON location_floor_plans;
CREATE POLICY "Customer portal users can view floor plans"
ON location_floor_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    INNER JOIN customer_locations cl ON cl.customer_id = cpu.customer_id
    WHERE cpu.user_id = auth.uid()
    AND location_floor_plans.location_id = cl.id
    AND cpu.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role::text IN ('tenant_admin', 'super_admin', 'management', 'supervisor', 'worker')
  )
);

-- Comment on the new role system
COMMENT ON TYPE customer_portal_role IS 'Three-tier customer portal access: full_access (all features including financial), supervisor (operational features), basic (limited to request creation and floor plan markup)';