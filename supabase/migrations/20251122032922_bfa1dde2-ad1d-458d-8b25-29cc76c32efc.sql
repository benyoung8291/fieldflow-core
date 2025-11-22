
-- Allow users to view profiles of field report creators for reports they can access
CREATE POLICY "Users can view field report creator profiles" ON public.profiles
FOR SELECT
TO public
USING (
  id IN (
    SELECT DISTINCT fr.created_by
    FROM field_reports fr
    WHERE fr.tenant_id = get_user_tenant_id()
  )
);
