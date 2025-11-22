-- Fix menu_items RLS policy to allow viewing when tenant is not set
DROP POLICY IF EXISTS "Users can view menu items in their tenant" ON menu_items;

CREATE POLICY "Users can view menu items in their tenant"
ON menu_items
FOR SELECT
USING (
  -- Allow if tenant matches OR if user has no tenant (development scenario)
  tenant_id = get_user_tenant_id()
  OR get_user_tenant_id() IS NULL
);