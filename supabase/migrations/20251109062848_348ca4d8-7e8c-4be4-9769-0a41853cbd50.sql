-- Create storage bucket for quote attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-attachments', 'quote-attachments', false);

-- Create RLS policies for quote attachments bucket
CREATE POLICY "Users can view attachments in their tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quote-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload attachments in their tenant"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quote-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete attachments in their tenant"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quote-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
  )
);