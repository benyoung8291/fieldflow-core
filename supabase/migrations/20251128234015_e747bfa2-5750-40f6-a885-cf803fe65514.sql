-- Create storage bucket for ticket markup photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-markups', 'ticket-markups', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own markup photos
CREATE POLICY "Users can upload ticket markup photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-markups' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM helpdesk_tickets 
    WHERE customer_id IN (
      SELECT customer_id FROM customer_portal_users WHERE user_id = auth.uid()
    )
  )
);

-- Allow public read access to ticket markup photos
CREATE POLICY "Public can view ticket markup photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ticket-markups');