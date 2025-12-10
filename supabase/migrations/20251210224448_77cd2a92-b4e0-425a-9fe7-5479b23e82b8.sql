-- Allow anonymous uploads to field-report-photos bucket for contractor submissions
-- First check if the policy exists and drop it if so
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Allow anonymous contractor photo uploads" ON storage.objects;
END $$;

-- Create policy for anonymous uploads to contractor folder
CREATE POLICY "Allow anonymous contractor photo uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'field-report-photos' 
  AND (storage.foldername(name))[1] = 'contractor'
);

-- Allow anonymous read access to contractor photos
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow anonymous contractor photo reads" ON storage.objects;
END $$;

CREATE POLICY "Allow anonymous contractor photo reads"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'field-report-photos' 
  AND (storage.foldername(name))[1] = 'contractor'
);