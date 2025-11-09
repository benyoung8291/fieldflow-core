-- Create quote item templates table
CREATE TABLE public.quote_item_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quote_type TEXT NOT NULL DEFAULT 'simple',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quote item template lines table
CREATE TABLE public.quote_item_template_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.quote_item_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  cost_price NUMERIC DEFAULT 0,
  margin_percentage NUMERIC DEFAULT 0,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  parent_line_item_id UUID,
  item_order INTEGER NOT NULL DEFAULT 0,
  price_book_item_id UUID,
  is_from_price_book BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_item_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_item_template_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_item_templates
CREATE POLICY "Users can view templates in their tenant"
  ON public.quote_item_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create templates in their tenant"
  ON public.quote_item_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update templates in their tenant"
  ON public.quote_item_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete templates in their tenant"
  ON public.quote_item_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for quote_item_template_lines
CREATE POLICY "Users can view template lines in their tenant"
  ON public.quote_item_template_lines FOR SELECT
  USING (template_id IN (
    SELECT id FROM public.quote_item_templates WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can create template lines in their tenant"
  ON public.quote_item_template_lines FOR INSERT
  WITH CHECK (template_id IN (
    SELECT id FROM public.quote_item_templates WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can update template lines in their tenant"
  ON public.quote_item_template_lines FOR UPDATE
  USING (template_id IN (
    SELECT id FROM public.quote_item_templates WHERE tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "Users can delete template lines in their tenant"
  ON public.quote_item_template_lines FOR DELETE
  USING (template_id IN (
    SELECT id FROM public.quote_item_templates WHERE tenant_id = get_user_tenant_id()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_quote_item_templates_updated_at
  BEFORE UPDATE ON public.quote_item_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Audit logging triggers
CREATE TRIGGER audit_quote_item_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_item_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_quote_item_template_lines
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_item_template_lines
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();