-- Create recurrence frequency enum
CREATE TYPE public.recurrence_frequency AS ENUM (
  'daily',
  'weekly',
  'bi_weekly',
  'monthly',
  'quarterly',
  'semi_annually',
  'annually',
  'one_time'
);

-- Create service contracts table
CREATE TABLE public.service_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  contract_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  total_contract_value NUMERIC NOT NULL DEFAULT 0,
  billing_frequency TEXT DEFAULT 'monthly',
  auto_generate BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  quote_id UUID REFERENCES public.quotes(id),
  notes TEXT
);

-- Create service contract line items table
CREATE TABLE public.service_contract_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  recurrence_frequency recurrence_frequency NOT NULL DEFAULT 'one_time',
  first_generation_date DATE NOT NULL,
  next_generation_date DATE,
  last_generated_date DATE,
  generation_day_of_month INTEGER,
  generation_day_of_week INTEGER,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update quotes table to track conversions
ALTER TABLE public.quotes ADD COLUMN converted_to_contract_id UUID REFERENCES public.service_contracts(id);

-- Enable RLS
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_contracts
CREATE POLICY "Users can view contracts in their tenant"
  ON public.service_contracts FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create contracts in their tenant"
  ON public.service_contracts FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update contracts in their tenant"
  ON public.service_contracts FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete contracts in their tenant"
  ON public.service_contracts FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for service_contract_line_items
CREATE POLICY "Users can view contract items in their tenant"
  ON public.service_contract_line_items FOR SELECT
  USING (contract_id IN (
    SELECT id FROM public.service_contracts WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can create contract items in their tenant"
  ON public.service_contract_line_items FOR INSERT
  WITH CHECK (contract_id IN (
    SELECT id FROM public.service_contracts WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can update contract items in their tenant"
  ON public.service_contract_line_items FOR UPDATE
  USING (contract_id IN (
    SELECT id FROM public.service_contracts WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can delete contract items in their tenant"
  ON public.service_contract_line_items FOR DELETE
  USING (contract_id IN (
    SELECT id FROM public.service_contracts WHERE tenant_id = get_user_tenant_id()
  ));

-- Triggers
CREATE TRIGGER update_service_contracts_updated_at
  BEFORE UPDATE ON public.service_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER audit_service_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_service_contract_line_items
  AFTER INSERT OR UPDATE OR DELETE ON public.service_contract_line_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();