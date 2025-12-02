-- Allow tenant users (staff) to insert markups
CREATE POLICY "Tenant users can insert markups"
ON ticket_markups FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND tenant_id = ticket_markups.tenant_id
  )
);

-- Allow tenant users (staff/workers) to update markups
CREATE POLICY "Tenant users can update markups"
ON ticket_markups FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND tenant_id = ticket_markups.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND tenant_id = ticket_markups.tenant_id
  )
);