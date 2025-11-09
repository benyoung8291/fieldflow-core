-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  quote_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  converted_to_service_order_id UUID,
  converted_to_project_id UUID
);

-- Create quote_line_items table
CREATE TABLE public.quote_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  item_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
CREATE POLICY "Users can view quotes in their tenant"
  ON public.quotes FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create quotes in their tenant"
  ON public.quotes FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update quotes in their tenant"
  ON public.quotes FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete quotes in their tenant"
  ON public.quotes FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for quote_line_items
CREATE POLICY "Users can view quote items in their tenant"
  ON public.quote_line_items FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create quote items in their tenant"
  ON public.quote_line_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update quote items in their tenant"
  ON public.quote_line_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete quote items in their tenant"
  ON public.quote_line_items FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Add triggers for updated_at
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_quote_line_items_updated_at
  BEFORE UPDATE ON public.quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add audit triggers
CREATE TRIGGER log_quotes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER log_quote_line_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();