-- Create appointment-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('appointment-attachments', 'appointment-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload to appointment-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view appointment-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete appointment-attachments in their tenant" ON storage.objects;

-- Allow users to upload files to appointment-attachments bucket
CREATE POLICY "Users can upload to appointment-attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'appointment-attachments' 
  AND auth.uid() IN (
    SELECT id FROM profiles 
    WHERE tenant_id = get_user_tenant_id()
  )
);

-- Allow anyone to view files in appointment-attachments bucket (public bucket)
CREATE POLICY "Anyone can view appointment-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'appointment-attachments');

-- Allow users to delete their own uploaded files
CREATE POLICY "Users can delete appointment-attachments in their tenant"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'appointment-attachments'
  AND auth.uid() IN (
    SELECT aa.uploaded_by 
    FROM appointment_attachments aa
    WHERE aa.file_url LIKE '%' || objects.name
  )
);