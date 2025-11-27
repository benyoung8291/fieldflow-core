-- Create customer portal settings table
CREATE TABLE IF NOT EXISTS public.customer_portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  allow_request_creation BOOLEAN NOT NULL DEFAULT true,
  allow_request_viewing BOOLEAN NOT NULL DEFAULT true,
  allow_location_viewing BOOLEAN NOT NULL DEFAULT true,
  custom_branding JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

-- Create customer portal users table
CREATE TABLE IF NOT EXISTS public.customer_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(tenant_id, email)
);

-- Create location floor plans table
CREATE TABLE IF NOT EXISTS public.location_floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.customer_locations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  floor_number TEXT,
  building_section TEXT,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_customer_portal_settings_customer ON public.customer_portal_settings(customer_id);
CREATE INDEX idx_customer_portal_settings_tenant ON public.customer_portal_settings(tenant_id);
CREATE INDEX idx_customer_portal_users_customer ON public.customer_portal_users(customer_id);
CREATE INDEX idx_customer_portal_users_tenant ON public.customer_portal_users(tenant_id);
CREATE INDEX idx_customer_portal_users_email ON public.customer_portal_users(email);
CREATE INDEX idx_location_floor_plans_location ON public.location_floor_plans(location_id);
CREATE INDEX idx_location_floor_plans_tenant ON public.location_floor_plans(tenant_id);

-- Enable RLS
ALTER TABLE public.customer_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_floor_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_portal_settings
CREATE POLICY "Users can view portal settings in their tenant"
  ON public.customer_portal_settings FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create portal settings in their tenant"
  ON public.customer_portal_settings FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update portal settings in their tenant"
  ON public.customer_portal_settings FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete portal settings in their tenant"
  ON public.customer_portal_settings FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for customer_portal_users
CREATE POLICY "Users can view portal users in their tenant"
  ON public.customer_portal_users FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Customers can view their own portal account"
  ON public.customer_portal_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create portal users in their tenant"
  ON public.customer_portal_users FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update portal users in their tenant"
  ON public.customer_portal_users FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Customer users can update their own account"
  ON public.customer_portal_users FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete portal users in their tenant"
  ON public.customer_portal_users FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for location_floor_plans
CREATE POLICY "Users can view floor plans in their tenant"
  ON public.location_floor_plans FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Customers can view floor plans for their locations"
  ON public.location_floor_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_locations cl
      INNER JOIN public.customer_portal_users cpu ON cpu.customer_id = cl.customer_id
      WHERE cl.id = location_floor_plans.location_id
        AND cpu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create floor plans in their tenant"
  ON public.location_floor_plans FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update floor plans in their tenant"
  ON public.location_floor_plans FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete floor plans in their tenant"
  ON public.location_floor_plans FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Function to ensure only one primary floor plan per location
CREATE OR REPLACE FUNCTION public.ensure_single_primary_floor_plan()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Unset all other primary floor plans for this location
    UPDATE public.location_floor_plans
    SET is_primary = false
    WHERE location_id = NEW.location_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for ensuring single primary floor plan
DROP TRIGGER IF EXISTS ensure_single_primary_floor_plan_trigger ON public.location_floor_plans;
CREATE TRIGGER ensure_single_primary_floor_plan_trigger
  BEFORE INSERT OR UPDATE ON public.location_floor_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_primary_floor_plan();

-- Function to update customer portal user last login
CREATE OR REPLACE FUNCTION public.update_customer_portal_user_last_login()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.customer_portal_users
  SET last_login_at = now()
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE public.customer_portal_settings IS 'Stores portal configuration for each customer';
COMMENT ON TABLE public.customer_portal_users IS 'Manages customer portal user accounts';
COMMENT ON TABLE public.location_floor_plans IS 'Stores floor plan files for customer locations';
COMMENT ON COLUMN public.customer_portal_settings.is_enabled IS 'Whether the portal is enabled for this customer';
COMMENT ON COLUMN public.customer_portal_settings.custom_branding IS 'JSON object for custom branding (logo, colors, etc)';
COMMENT ON COLUMN public.customer_portal_users.is_active IS 'Whether this portal user account is active';
COMMENT ON COLUMN public.location_floor_plans.is_primary IS 'Whether this is the primary/default floor plan for the location';