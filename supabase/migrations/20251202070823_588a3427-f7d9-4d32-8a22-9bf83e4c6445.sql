-- Add storage policies for staff users to upload and delete ticket markup photos

-- Allow staff/tenant users to upload ticket markup photos
CREATE POLICY "Staff can upload ticket markup photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-markups'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND tenant_id IS NOT NULL
  )
);

-- Allow staff/tenant users to delete ticket markup photos
CREATE POLICY "Staff can delete ticket markup photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-markups'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND tenant_id IS NOT NULL
  )
);