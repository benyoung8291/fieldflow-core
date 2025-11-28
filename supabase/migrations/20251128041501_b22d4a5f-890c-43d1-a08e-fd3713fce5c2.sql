-- Add RLS policies for service_contract_line_items
-- Allow users to view line items for contracts in their tenant
CREATE POLICY "Users can view service contract line items in their tenant"
ON service_contract_line_items
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to insert line items for contracts in their tenant
CREATE POLICY "Users can create service contract line items in their tenant"
ON service_contract_line_items
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to update line items for contracts in their tenant
CREATE POLICY "Users can update service contract line items in their tenant"
ON service_contract_line_items
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to delete line items for contracts in their tenant
CREATE POLICY "Users can delete service contract line items in their tenant"
ON service_contract_line_items
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Add RLS policies for service_contracts table as well
-- Allow users to view contracts in their tenant
CREATE POLICY "Users can view service contracts in their tenant"
ON service_contracts
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to insert contracts in their tenant
CREATE POLICY "Users can create service contracts in their tenant"
ON service_contracts
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to update contracts in their tenant
CREATE POLICY "Users can update service contracts in their tenant"
ON service_contracts
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow users to delete contracts in their tenant
CREATE POLICY "Users can delete service contracts in their tenant"
ON service_contracts
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);