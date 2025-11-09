-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  rating TEXT,
  notes TEXT,
  assigned_to UUID,
  converted_to_customer_id UUID,
  converted_at TIMESTAMP WITH TIME ZONE,
  converted_by UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create lead contacts table
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create lead activities table for tracking interactions
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  activity_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Modify quotes table to support leads
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS is_for_lead BOOLEAN DEFAULT false;

-- Add constraint to ensure quote is for either customer or lead, not both
ALTER TABLE public.quotes ADD CONSTRAINT quote_customer_or_lead_check 
  CHECK (
    (customer_id IS NOT NULL AND lead_id IS NULL AND is_for_lead = false) OR
    (lead_id IS NOT NULL AND customer_id IS NULL AND is_for_lead = true)
  );

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
CREATE POLICY "Users can view leads in their tenant"
  ON public.leads FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create leads in their tenant"
  ON public.leads FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update leads in their tenant"
  ON public.leads FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete unconverted leads in their tenant"
  ON public.leads FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND converted_to_customer_id IS NULL);

-- RLS Policies for lead_contacts
CREATE POLICY "Users can view lead contacts in their tenant"
  ON public.lead_contacts FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create lead contacts in their tenant"
  ON public.lead_contacts FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update lead contacts in their tenant"
  ON public.lead_contacts FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete lead contacts in their tenant"
  ON public.lead_contacts FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for lead_activities
CREATE POLICY "Users can view lead activities in their tenant"
  ON public.lead_activities FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create lead activities in their tenant"
  ON public.lead_activities FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update lead activities in their tenant"
  ON public.lead_activities FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete lead activities in their tenant"
  ON public.lead_activities FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create triggers for updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_lead_contacts_updated_at
  BEFORE UPDATE ON public.lead_contacts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Create audit triggers
CREATE TRIGGER leads_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Create indexes for performance
CREATE INDEX idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_converted ON public.leads(converted_to_customer_id);
CREATE INDEX idx_lead_contacts_lead_id ON public.lead_contacts(lead_id);
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);