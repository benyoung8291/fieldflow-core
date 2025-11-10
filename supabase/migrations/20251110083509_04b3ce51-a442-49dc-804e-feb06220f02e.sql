-- Create CRM status settings table for pipeline stages
CREATE TABLE IF NOT EXISTS public.crm_status_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL,
  display_name TEXT NOT NULL,
  probability_percentage NUMERIC NOT NULL DEFAULT 50,
  color TEXT NOT NULL DEFAULT '#0891B2',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, status)
);

-- Enable RLS
ALTER TABLE public.crm_status_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view CRM statuses in their tenant"
  ON public.crm_status_settings
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create CRM statuses in their tenant"
  ON public.crm_status_settings
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update CRM statuses in their tenant"
  ON public.crm_status_settings
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete CRM statuses in their tenant"
  ON public.crm_status_settings
  FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create trigger for updated_at
CREATE TRIGGER update_crm_status_settings_updated_at
  BEFORE UPDATE ON public.crm_status_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default CRM statuses for reference
COMMENT ON TABLE public.crm_status_settings IS 'CRM pipeline stages configuration with probability ratings for weighted pipeline calculations';