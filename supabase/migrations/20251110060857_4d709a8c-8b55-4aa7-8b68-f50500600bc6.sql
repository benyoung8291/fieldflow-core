-- Create appointment_attachments table
CREATE TABLE public.appointment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  category TEXT DEFAULT 'general',
  notes TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view appointment attachments in their tenant"
ON public.appointment_attachments
FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create appointment attachments in their tenant"
ON public.appointment_attachments
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update appointment attachments in their tenant"
ON public.appointment_attachments
FOR UPDATE
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete appointment attachments in their tenant"
ON public.appointment_attachments
FOR DELETE
USING (tenant_id = get_user_tenant_id());

-- Create index for faster queries
CREATE INDEX idx_appointment_attachments_appointment_id ON public.appointment_attachments(appointment_id);
CREATE INDEX idx_appointment_attachments_tenant_id ON public.appointment_attachments(tenant_id);

-- Create storage bucket for appointment files
INSERT INTO storage.buckets (id, name, public)
VALUES ('appointment-files', 'appointment-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for appointment files
CREATE POLICY "Users can view appointment files in their tenant"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'appointment-files' AND
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN appointment_attachments aa ON aa.tenant_id = p.tenant_id
    WHERE aa.file_url LIKE '%' || name
  )
);

CREATE POLICY "Users can upload appointment files in their tenant"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'appointment-files' AND
  auth.uid() IN (SELECT id FROM profiles WHERE tenant_id = get_user_tenant_id())
);

CREATE POLICY "Users can update appointment files in their tenant"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'appointment-files' AND
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN appointment_attachments aa ON aa.tenant_id = p.tenant_id
    WHERE aa.file_url LIKE '%' || name
  )
);

CREATE POLICY "Users can delete appointment files in their tenant"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'appointment-files' AND
  auth.uid() IN (
    SELECT p.id FROM profiles p
    JOIN appointment_attachments aa ON aa.tenant_id = p.tenant_id
    WHERE aa.file_url LIKE '%' || name
  )
);