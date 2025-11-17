-- Enable all users to view all templates in their tenant
CREATE POLICY "Users can view all templates in their tenant"
ON quote_description_templates
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Enable users to create their own templates
CREATE POLICY "Users can create templates"
ON quote_description_templates
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Enable users to delete only their own templates
CREATE POLICY "Users can delete their own templates"
ON quote_description_templates
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);