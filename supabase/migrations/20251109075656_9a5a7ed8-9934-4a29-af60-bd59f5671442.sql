-- Create customer_locations table
CREATE TABLE public.customer_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  location_notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_locations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view locations in their tenant"
  ON public.customer_locations FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create locations in their tenant"
  ON public.customer_locations FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update locations in their tenant"
  ON public.customer_locations FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete locations in their tenant"
  ON public.customer_locations FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Add location_id to service_contract_line_items
ALTER TABLE public.service_contract_line_items
ADD COLUMN location_id UUID REFERENCES public.customer_locations(id);

-- Add location_id to service_orders
ALTER TABLE public.service_orders
ADD COLUMN location_id UUID REFERENCES public.customer_locations(id);

-- Create service_contract_attachments table
CREATE TABLE public.service_contract_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_contract_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view attachments in their tenant"
  ON public.service_contract_attachments FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create attachments in their tenant"
  ON public.service_contract_attachments FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete attachments in their tenant"
  ON public.service_contract_attachments FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create storage bucket for contract files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contract-attachments', 'contract-attachments', false);

-- Create storage policies
CREATE POLICY "Users can view their tenant's contract files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-attachments' AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can upload their tenant's contract files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contract-attachments' AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their tenant's contract files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contract-attachments' AND (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  ));

-- Create trigger for customer_locations updated_at
CREATE TRIGGER update_customer_locations_updated_at
  BEFORE UPDATE ON public.customer_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes
CREATE INDEX idx_customer_locations_customer_id ON public.customer_locations(customer_id);
CREATE INDEX idx_customer_locations_tenant_id ON public.customer_locations(tenant_id);
CREATE INDEX idx_service_contract_line_items_location_id ON public.service_contract_line_items(location_id);
CREATE INDEX idx_service_orders_location_id ON public.service_orders(location_id);
CREATE INDEX idx_service_contract_attachments_contract_id ON public.service_contract_attachments(contract_id);