-- Add INSERT policy for chat_channels to allow users to create channels
CREATE POLICY "Authenticated users can create channels in their tenant"
ON chat_channels
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);