-- Create storage bucket for field report photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('field-report-photos', 'field-report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for field report photos
CREATE POLICY "Users can view field report photos in their tenant"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'field-report-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload field report photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'field-report-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their field report photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'field-report-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete field report photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'field-report-photos' AND auth.role() = 'authenticated');