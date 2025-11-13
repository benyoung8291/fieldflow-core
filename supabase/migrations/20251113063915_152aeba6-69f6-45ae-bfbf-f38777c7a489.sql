-- Create comprehensive contacts table for full contact lifecycle management
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  -- Basic contact information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  position TEXT,
  
  -- Contact categorization
  contact_type TEXT NOT NULL DEFAULT 'prospect',
  -- Types: 'prospect', 'lead', 'customer_contact', 'supplier_contact', 'other'
  
  -- Contact status and lifecycle
  status TEXT NOT NULL DEFAULT 'active',
  -- Status: 'active', 'inactive', 'converted', 'unqualified'
  
  source TEXT,
  -- Source: 'referral', 'website', 'cold_call', 'linkedin', 'event', 'other'
  
  -- Relationships
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Additional information
  company_name TEXT,
  notes TEXT,
  tags TEXT[],
  
  -- Social and communication
  linkedin_url TEXT,
  website TEXT,
  
  -- Address information
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  
  -- Ownership and assignment
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  
  -- Primary contact flag (for customer/supplier contacts)
  is_primary BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view contacts in their tenant"
  ON public.contacts
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create contacts in their tenant"
  ON public.contacts
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update contacts in their tenant"
  ON public.contacts
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete contacts in their tenant"
  ON public.contacts
  FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Indexes for performance
CREATE INDEX idx_contacts_tenant_id ON public.contacts(tenant_id);
CREATE INDEX idx_contacts_type ON public.contacts(contact_type);
CREATE INDEX idx_contacts_status ON public.contacts(status);
CREATE INDEX idx_contacts_customer_id ON public.contacts(customer_id);
CREATE INDEX idx_contacts_supplier_id ON public.contacts(supplier_id);
CREATE INDEX idx_contacts_lead_id ON public.contacts(lead_id);
CREATE INDEX idx_contacts_assigned_to ON public.contacts(assigned_to);
CREATE INDEX idx_contacts_email ON public.contacts(email);

-- Trigger for updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: Link existing customer_contacts to new contacts table
-- This creates a contact record for each existing customer contact
INSERT INTO public.contacts (
  tenant_id,
  first_name,
  last_name,
  email,
  phone,
  mobile,
  position,
  notes,
  contact_type,
  status,
  customer_id,
  is_primary,
  created_at,
  updated_at
)
SELECT 
  cc.tenant_id,
  cc.first_name,
  cc.last_name,
  cc.email,
  cc.phone,
  cc.mobile,
  cc.position,
  cc.notes,
  'customer_contact'::TEXT,
  'active'::TEXT,
  cc.customer_id,
  cc.is_primary,
  cc.created_at,
  cc.updated_at
FROM public.customer_contacts cc
ON CONFLICT DO NOTHING;