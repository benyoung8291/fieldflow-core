-- Create document_templates storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document_templates',
  'document_templates',
  false,
  10485760, -- 10MB
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read templates from their tenant
CREATE POLICY "Users can read templates from their tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'document_templates' AND
  EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.template_file_url LIKE '%' || storage.objects.name
      AND dt.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  )
);

-- Allow authenticated users to upload templates
CREATE POLICY "Users can upload templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'document_templates'
);

-- Allow authenticated users to delete their tenant's templates
CREATE POLICY "Users can delete their tenant's templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'document_templates' AND
  EXISTS (
    SELECT 1 FROM document_templates dt
    WHERE dt.template_file_url LIKE '%' || storage.objects.name
      AND dt.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  )
);

-- Service role can access all files (for edge functions)
CREATE POLICY "Service role can access all files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'document_templates')
WITH CHECK (bucket_id = 'document_templates');