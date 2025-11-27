
-- Create RLS policies for field_report_photos to allow viewing

-- Allow customer portal users to view photos for their own field reports
CREATE POLICY "Customer portal users can view their field report photos"
ON field_report_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM customer_portal_users cpu
    JOIN field_reports fr ON fr.customer_id = cpu.customer_id
    WHERE cpu.user_id = auth.uid()
    AND fr.id = field_report_photos.field_report_id
  )
);

-- Allow internal users (anyone with a profile) to view all field report photos in their tenant
CREATE POLICY "Internal users can view all field report photos"
ON field_report_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.tenant_id = field_report_photos.tenant_id
  )
);
