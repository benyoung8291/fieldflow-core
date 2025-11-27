
-- Drop the existing policies
DROP POLICY IF EXISTS "Customer portal users can view their field report photos" ON field_report_photos;
DROP POLICY IF EXISTS "Internal users can view all field report photos" ON field_report_photos;

-- Create a security definer function to check if user can access a field report
CREATE OR REPLACE FUNCTION public.can_view_field_report(report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user is a customer portal user with access to this report
  SELECT EXISTS (
    SELECT 1 
    FROM customer_portal_users cpu
    JOIN field_reports fr ON fr.customer_id = cpu.customer_id
    WHERE cpu.user_id = auth.uid()
    AND fr.id = report_id
  )
  OR
  -- Or if user is an internal user in the same tenant
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN field_reports fr ON fr.tenant_id = p.tenant_id
    WHERE p.id = auth.uid()
    AND fr.id = report_id
  );
$$;

-- Create new policies using the security definer function
CREATE POLICY "Users can view field report photos if they can view the report"
ON field_report_photos
FOR SELECT
TO authenticated
USING (public.can_view_field_report(field_report_id));
