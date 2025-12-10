-- Create contractor_field_report_links table
CREATE TABLE public.contractor_field_report_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create contractor_customer_visibility table for hiding customers from specific contractors
CREATE TABLE public.contractor_customer_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT true,
  hidden_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT contact_or_worker CHECK (contact_id IS NOT NULL OR worker_id IS NOT NULL),
  CONSTRAINT unique_visibility UNIQUE (tenant_id, contact_id, worker_id, customer_id)
);

-- Add new columns to field_reports table
ALTER TABLE public.field_reports 
ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS contractor_phone TEXT,
ADD COLUMN IF NOT EXISTS contractor_name TEXT,
ADD COLUMN IF NOT EXISTS manual_location_entry TEXT,
ADD COLUMN IF NOT EXISTS needs_customer_mapping BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mapped_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS mapped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_contact_id UUID REFERENCES contacts(id);

-- Add comment for submission_type values
COMMENT ON COLUMN public.field_reports.submission_type IS 'Values: internal, verified_contractor, unverified_contractor';

-- Enable RLS on new tables
ALTER TABLE public.contractor_field_report_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_customer_visibility ENABLE ROW LEVEL SECURITY;

-- RLS for contractor_field_report_links
-- Authenticated users in tenant can manage links
CREATE POLICY "Users can view their tenant links"
ON public.contractor_field_report_links
FOR SELECT
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create links in their tenant"
ON public.contractor_field_report_links
FOR INSERT
TO authenticated
WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant links"
ON public.contractor_field_report_links
FOR UPDATE
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their tenant links"
ON public.contractor_field_report_links
FOR DELETE
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Anonymous users can read active, non-expired links (for public page validation)
CREATE POLICY "Anon can read active links"
ON public.contractor_field_report_links
FOR SELECT
TO anon
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RLS for contractor_customer_visibility
CREATE POLICY "Users can view their tenant visibility settings"
ON public.contractor_customer_visibility
FOR SELECT
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their tenant visibility settings"
ON public.contractor_customer_visibility
FOR ALL
TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_contractor_links_token ON public.contractor_field_report_links(token);
CREATE INDEX idx_contractor_links_tenant ON public.contractor_field_report_links(tenant_id);
CREATE INDEX idx_contractor_visibility_contact ON public.contractor_customer_visibility(contact_id);
CREATE INDEX idx_contractor_visibility_worker ON public.contractor_customer_visibility(worker_id);
CREATE INDEX idx_contractor_visibility_customer ON public.contractor_customer_visibility(customer_id);
CREATE INDEX idx_field_reports_submission_type ON public.field_reports(submission_type);
CREATE INDEX idx_field_reports_needs_mapping ON public.field_reports(needs_customer_mapping) WHERE needs_customer_mapping = true;

-- Update trigger for contractor_field_report_links
CREATE TRIGGER update_contractor_field_report_links_updated_at
  BEFORE UPDATE ON public.contractor_field_report_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_floor_plans_updated_at();