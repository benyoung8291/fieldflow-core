-- Enable DELETE policy for customers table
-- This allows users to delete customers in their tenant

CREATE POLICY "Users can delete customers in their tenant"
ON public.customers
FOR DELETE
USING (tenant_id = get_user_tenant_id());
