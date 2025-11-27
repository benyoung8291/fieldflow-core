-- Update floor-plans bucket with CORS configuration
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
WHERE id = 'floor-plans';

-- Note: CORS headers need to be configured at the Supabase project level
-- The following configuration needs to be set in your Supabase dashboard:
-- Storage > Configuration > CORS Configuration
-- Add the following origins:
-- - https://*.lovableproject.com
-- - http://localhost:*
-- Allowed headers: authorization, x-client-info, apikey, content-type
-- Exposed headers: content-range, content-length