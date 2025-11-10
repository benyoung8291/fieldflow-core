-- Add accounting integration settings table
CREATE TABLE IF NOT EXISTS public.accounting_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('myob_acumatica', 'xero')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- MYOB Acumatica fields
  acumatica_instance_url TEXT,
  acumatica_company_name TEXT,
  
  -- Xero fields
  xero_tenant_id TEXT,
  
  -- Common fields
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT,
  sync_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(tenant_id, provider)
);

-- Enable RLS
ALTER TABLE public.accounting_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for accounting integrations
CREATE POLICY "Admins can manage accounting integrations"
  ON public.accounting_integrations
  FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));

CREATE POLICY "Users can view accounting integrations in their tenant"
  ON public.accounting_integrations
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Add integration sync log table
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES public.accounting_integrations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  external_reference TEXT,
  error_message TEXT,
  request_data JSONB,
  response_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync logs
CREATE POLICY "Users can view sync logs in their tenant"
  ON public.integration_sync_logs
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert sync logs"
  ON public.integration_sync_logs
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Add trigger for updated_at on accounting_integrations
CREATE TRIGGER update_accounting_integrations_updated_at
  BEFORE UPDATE ON public.accounting_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();