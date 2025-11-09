-- Update customers table with billing and sub-account fields
ALTER TABLE public.customers 
ADD COLUMN abn TEXT,
ADD COLUMN legal_company_name TEXT,
ADD COLUMN trading_name TEXT,
ADD COLUMN parent_customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
ADD COLUMN billing_email TEXT,
ADD COLUMN billing_phone TEXT,
ADD COLUMN billing_address TEXT,
ADD COLUMN payment_terms INTEGER DEFAULT 30,
ADD COLUMN tax_exempt BOOLEAN DEFAULT false,
ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Create contacts table
CREATE TABLE public.customer_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  position TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_contacts
CREATE POLICY "Users can view contacts in their tenant"
  ON public.customer_contacts FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can create contacts in their tenant"
  ON public.customer_contacts FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can update contacts in their tenant"
  ON public.customer_contacts FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can delete contacts in their tenant"
  ON public.customer_contacts FOR DELETE
  USING (tenant_id = public.get_user_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER set_customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes
CREATE INDEX idx_customer_contacts_tenant_id ON public.customer_contacts(tenant_id);
CREATE INDEX idx_customer_contacts_customer_id ON public.customer_contacts(customer_id);
CREATE INDEX idx_customers_parent_customer_id ON public.customers(parent_customer_id);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);