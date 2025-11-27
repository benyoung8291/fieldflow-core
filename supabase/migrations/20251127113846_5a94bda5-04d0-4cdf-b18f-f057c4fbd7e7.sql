-- Add public read access policy for floor-plans bucket
-- This allows PDFs to be viewed in browser without CORS issues

CREATE POLICY "Public can view floor plans"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'floor-plans');