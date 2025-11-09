-- Create module enum
CREATE TYPE public.app_module AS ENUM (
  'customers',
  'leads', 
  'quotes',
  'projects',
  'service_orders',
  'appointments',
  'workers',
  'service_contracts',
  'analytics',
  'settings',
  'price_book'
);

-- Create permission type enum
CREATE TYPE public.permission_type AS ENUM ('view', 'create', 'edit', 'delete');

-- Create role_permissions table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  role user_role NOT NULL,
  module app_module NOT NULL,
  permission permission_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, role, module, permission)
);

-- Enable RLS on role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Create function to check if user has permission
CREATE OR REPLACE FUNCTION public.has_permission(_module app_module, _permission permission_type)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    INNER JOIN public.user_roles ur ON ur.role = rp.role AND ur.tenant_id = rp.tenant_id
    WHERE ur.user_id = auth.uid()
      AND rp.module = _module
      AND rp.permission = _permission
      AND rp.tenant_id = get_user_tenant_id()
  ) OR has_role(auth.uid(), 'tenant_admin');
$$;

-- RLS policies for role_permissions
CREATE POLICY "Users can view permissions in their tenant"
ON public.role_permissions FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));

-- Add updated_at trigger for role_permissions
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Initialize default permissions for tenant_admin (full access to everything)
INSERT INTO public.role_permissions (tenant_id, role, module, permission)
SELECT DISTINCT 
  tenant_id,
  'tenant_admin'::user_role,
  m.module,
  p.permission
FROM profiles
CROSS JOIN unnest(ARRAY['customers', 'leads', 'quotes', 'projects', 'service_orders', 'appointments', 'workers', 'service_contracts', 'analytics', 'settings', 'price_book']::app_module[]) AS m(module)
CROSS JOIN unnest(ARRAY['view', 'create', 'edit', 'delete']::permission_type[]) AS p(permission)
WHERE tenant_id IS NOT NULL
ON CONFLICT (tenant_id, role, module, permission) DO NOTHING;