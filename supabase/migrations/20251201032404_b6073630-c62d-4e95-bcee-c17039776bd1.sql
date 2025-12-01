-- Phase 1: Add missing default_tax_rate column to tenant_settings
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC DEFAULT 10;

-- Phase 4: Create SECURITY DEFINER function for safe tenant access checking
CREATE OR REPLACE FUNCTION user_can_access_tenant(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND tenant_id = check_tenant_id
  );
$$;

-- Phase 2: Add DELETE policy for service_orders
DROP POLICY IF EXISTS "Users can delete service orders in their tenant" ON service_orders;
CREATE POLICY "Users can delete service orders in their tenant" 
ON service_orders FOR DELETE 
TO authenticated
USING (user_can_access_tenant(tenant_id));

-- Phase 3: Fix service_orders RLS policies to use authenticated role
DROP POLICY IF EXISTS "Users can insert service orders in their tenant" ON service_orders;
CREATE POLICY "Users can insert service orders in their tenant" 
ON service_orders FOR INSERT 
TO authenticated
WITH CHECK (user_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can update service orders in their tenant" ON service_orders;
CREATE POLICY "Users can update service orders in their tenant" 
ON service_orders FOR UPDATE 
TO authenticated
USING (user_can_access_tenant(tenant_id))
WITH CHECK (user_can_access_tenant(tenant_id));

-- Fix customer_locations RLS policies
DROP POLICY IF EXISTS "Users can insert customer locations in their tenant" ON customer_locations;
CREATE POLICY "Users can insert customer locations in their tenant" 
ON customer_locations FOR INSERT 
TO authenticated
WITH CHECK (user_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can update customer locations in their tenant" ON customer_locations;
CREATE POLICY "Users can update customer locations in their tenant" 
ON customer_locations FOR UPDATE 
TO authenticated
USING (user_can_access_tenant(tenant_id))
WITH CHECK (user_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can delete customer locations in their tenant" ON customer_locations;
CREATE POLICY "Users can delete customer locations in their tenant" 
ON customer_locations FOR DELETE 
TO authenticated
USING (user_can_access_tenant(tenant_id));

-- Fix customers RLS policies
DROP POLICY IF EXISTS "Users can insert customers in their tenant" ON customers;
CREATE POLICY "Users can insert customers in their tenant" 
ON customers FOR INSERT 
TO authenticated
WITH CHECK (user_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can update customers in their tenant" ON customers;
CREATE POLICY "Users can update customers in their tenant" 
ON customers FOR UPDATE 
TO authenticated
USING (user_can_access_tenant(tenant_id))
WITH CHECK (user_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can delete customers in their tenant" ON customers;
CREATE POLICY "Users can delete customers in their tenant" 
ON customers FOR DELETE 
TO authenticated
USING (user_can_access_tenant(tenant_id));

-- Fix service_order_line_items RLS policies
DROP POLICY IF EXISTS "Users can insert service order line items in their tenant" ON service_order_line_items;
CREATE POLICY "Users can insert service order line items in their tenant" 
ON service_order_line_items FOR INSERT 
TO authenticated
WITH CHECK (user_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can update service order line items in their tenant" ON service_order_line_items;
CREATE POLICY "Users can update service order line items in their tenant" 
ON service_order_line_items FOR UPDATE 
TO authenticated
USING (user_can_access_tenant(tenant_id))
WITH CHECK (user_can_access_tenant(tenant_id));

DROP POLICY IF EXISTS "Users can delete service order line items in their tenant" ON service_order_line_items;
CREATE POLICY "Users can delete service order line items in their tenant" 
ON service_order_line_items FOR DELETE 
TO authenticated
USING (user_can_access_tenant(tenant_id));

-- Phase 5: Fix role_permissions RLS policy to prevent circular references
DROP POLICY IF EXISTS "Users can view their role permissions" ON role_permissions;
CREATE POLICY "Users can view their role permissions" 
ON role_permissions FOR SELECT 
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);