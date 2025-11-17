-- Create quote_description_templates table
CREATE TABLE IF NOT EXISTS public.quote_description_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_quote_description_templates_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.quote_description_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view templates in their tenant"
  ON public.quote_description_templates
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create templates in their tenant"
  ON public.quote_description_templates
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update templates in their tenant"
  ON public.quote_description_templates
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete templates in their tenant"
  ON public.quote_description_templates
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_quote_description_templates_tenant ON public.quote_description_templates(tenant_id);

-- Create trigger for updated_at
CREATE TRIGGER update_quote_description_templates_updated_at
  BEFORE UPDATE ON public.quote_description_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();