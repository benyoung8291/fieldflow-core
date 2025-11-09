-- Create customer message templates table
CREATE TABLE IF NOT EXISTS public.customer_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create terms and conditions templates table
CREATE TABLE IF NOT EXISTS public.terms_conditions_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create quote templates table for PDF generation settings
CREATE TABLE IF NOT EXISTS public.quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  show_cost_analysis BOOLEAN DEFAULT false,
  show_sub_items BOOLEAN DEFAULT true,
  show_margins BOOLEAN DEFAULT false,
  header_logo_url TEXT,
  header_text TEXT,
  footer_text TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create quote email tracking table
CREATE TABLE IF NOT EXISTS public.quote_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sent_to TEXT NOT NULL,
  sent_by UUID NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  subject TEXT,
  message TEXT
);

-- Enable RLS
ALTER TABLE public.customer_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_conditions_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_message_templates
CREATE POLICY "Users can view templates in their tenant"
  ON public.customer_message_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create templates in their tenant"
  ON public.customer_message_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update templates in their tenant"
  ON public.customer_message_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete templates in their tenant"
  ON public.customer_message_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for terms_conditions_templates
CREATE POLICY "Users can view terms templates in their tenant"
  ON public.terms_conditions_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create terms templates in their tenant"
  ON public.terms_conditions_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update terms templates in their tenant"
  ON public.terms_conditions_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete terms templates in their tenant"
  ON public.terms_conditions_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for quote_templates
CREATE POLICY "Users can view quote templates in their tenant"
  ON public.quote_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create quote templates in their tenant"
  ON public.quote_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update quote templates in their tenant"
  ON public.quote_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete quote templates in their tenant"
  ON public.quote_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for quote_emails
CREATE POLICY "Users can view quote emails in their tenant"
  ON public.quote_emails FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert quote emails"
  ON public.quote_emails FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Create triggers for updated_at
CREATE TRIGGER update_customer_message_templates_updated_at
  BEFORE UPDATE ON public.customer_message_templates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_terms_conditions_templates_updated_at
  BEFORE UPDATE ON public.terms_conditions_templates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_quote_templates_updated_at
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Add customer_message field to quotes table
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_message TEXT;