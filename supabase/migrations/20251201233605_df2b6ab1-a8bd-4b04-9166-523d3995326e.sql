-- Add RLS policy for anonymous users to read floor plans via active share links
CREATE POLICY "Anon can read floor plans via active share links"
ON floor_plans
FOR SELECT
TO anon
USING (
  id IN (
    SELECT floor_plan_id FROM floor_plan_share_links
    WHERE is_active = true
    AND expires_at > now()
    AND (max_submissions IS NULL OR usage_count < max_submissions)
  )
);

-- Add RLS policy for anonymous users to read locations via active share links
CREATE POLICY "Anon can read locations via active share links"
ON customer_locations
FOR SELECT
TO anon
USING (
  id IN (
    SELECT location_id FROM floor_plan_share_links
    WHERE is_active = true
    AND expires_at > now()
    AND (max_submissions IS NULL OR usage_count < max_submissions)
  )
);