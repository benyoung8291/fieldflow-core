-- Add pdf_url column to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Add pdf_url column to ap_invoices table
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for invoice PDFs - authenticated users can read
CREATE POLICY "Authenticated users can view invoice PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoice-pdfs');

-- RLS policy for service role to upload PDFs
CREATE POLICY "Service role can upload invoice PDFs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'invoice-pdfs');

-- RLS policy for authenticated users to upload PDFs (for edge functions with user context)
CREATE POLICY "Authenticated users can upload invoice PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoice-pdfs');