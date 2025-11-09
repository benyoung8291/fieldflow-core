-- Create tenant settings table for storing general tenant configurations
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  renewal_notification_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view settings in their tenant"
  ON public.tenant_settings
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can update settings in their tenant"
  ON public.tenant_settings
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));

CREATE POLICY "Admins can insert settings in their tenant"
  ON public.tenant_settings
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();