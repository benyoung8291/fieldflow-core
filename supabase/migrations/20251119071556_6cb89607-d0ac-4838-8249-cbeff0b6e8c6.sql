-- Allow users to update accounting integrations in their own tenant
CREATE POLICY "Users can update accounting integrations in their tenant"
ON accounting_integrations
FOR UPDATE
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());