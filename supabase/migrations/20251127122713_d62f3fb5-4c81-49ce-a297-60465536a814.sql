-- Allow customer portal users to view floor plans in storage bucket
CREATE POLICY "Customer portal users can view floor plans"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'floor-plans' AND
  EXISTS (
    SELECT 1 FROM floor_plans fp
    JOIN customer_locations cl ON fp.customer_location_id = cl.id
    JOIN customer_portal_users cpu ON cpu.customer_id = cl.customer_id
    WHERE fp.file_path = storage.objects.name
    AND cpu.user_id = auth.uid()
    AND cpu.is_active = true
  )
);