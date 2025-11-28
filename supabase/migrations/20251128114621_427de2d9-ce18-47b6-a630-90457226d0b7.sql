-- Create storage bucket for template assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-assets',
  'template-assets',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload template assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'template-assets' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read access
CREATE POLICY "Anyone can view template assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-assets');