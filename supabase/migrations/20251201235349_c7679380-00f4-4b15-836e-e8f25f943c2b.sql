-- Add storage policy for anonymous users to upload ticket markup photos
CREATE POLICY "Anon can upload ticket markup photos"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'ticket-markups');

-- Add RLS policy for authenticated users to read active non-expired share links
CREATE POLICY "Authenticated can read active non-expired links by token"
ON floor_plan_share_links
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND expires_at > now()
  AND (max_submissions IS NULL OR usage_count < max_submissions)
);

-- Add RLS policy for authenticated users to read floor plans via active share links
CREATE POLICY "Authenticated can read floor plans via active share links"
ON floor_plans
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT floor_plan_id FROM floor_plan_share_links
    WHERE is_active = true
    AND expires_at > now()
    AND (max_submissions IS NULL OR usage_count < max_submissions)
  )
);

-- Add RLS policy for authenticated users to read locations via active share links
CREATE POLICY "Authenticated can read locations via active share links"
ON customer_locations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT location_id FROM floor_plan_share_links
    WHERE is_active = true
    AND expires_at > now()
    AND (max_submissions IS NULL OR usage_count < max_submissions)
  )
);