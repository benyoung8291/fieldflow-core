-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user roles enum
CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'tenant_admin',
  'supervisor',
  'worker',
  'accountant',
  'warehouse_manager',
  'subcontractor'
);

-- Create tenant status enum
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'trial');

-- Create service order status enum
CREATE TYPE public.service_order_status AS ENUM ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled');

-- Tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  email_domain TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0891B2',
  secondary_color TEXT DEFAULT '#F59E0B',
  status public.tenant_status DEFAULT 'trial',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles table (separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, role)
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service orders table
CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.service_order_status DEFAULT 'draft',
  billing_type TEXT CHECK (billing_type IN ('hourly', 'fixed', 'both')),
  hourly_rate DECIMAL(10,2),
  fixed_amount DECIMAL(10,2),
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scheduled_date DATE,
  completed_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, order_number)
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- RLS Policies for tenants
CREATE POLICY "Super admins can view all tenants"
  ON public.tenants FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Tenant admins can manage roles in their tenant"
  ON public.user_roles FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id() 
    AND public.has_role(auth.uid(), 'tenant_admin')
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their tenant"
  ON public.profiles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- RLS Policies for customers
CREATE POLICY "Users can view customers in their tenant"
  ON public.customers FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can create customers in their tenant"
  ON public.customers FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can update customers in their tenant"
  ON public.customers FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

-- RLS Policies for service_orders
CREATE POLICY "Users can view service orders in their tenant"
  ON public.service_orders FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can create service orders in their tenant"
  ON public.service_orders FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Users can update service orders in their tenant"
  ON public.service_orders FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();