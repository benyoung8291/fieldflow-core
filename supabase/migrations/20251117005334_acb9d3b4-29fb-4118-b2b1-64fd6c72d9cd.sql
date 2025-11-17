-- Create contact_activities table for tracking CRM activities
CREATE TABLE IF NOT EXISTS public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('note', 'phone_call', 'email', 'meeting')),
  activity_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  subject TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_contact_activities_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view activities in their tenant"
  ON public.contact_activities
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create activities in their tenant"
  ON public.contact_activities
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update activities in their tenant"
  ON public.contact_activities
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete activities in their tenant"
  ON public.contact_activities
  FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create index for faster queries
CREATE INDEX idx_contact_activities_contact_id ON public.contact_activities(contact_id);
CREATE INDEX idx_contact_activities_tenant_id ON public.contact_activities(tenant_id);