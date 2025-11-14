-- Create suppliers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  abn TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  payment_terms INTEGER DEFAULT 30,
  gst_registered BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on suppliers table
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view suppliers in their tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Users can create suppliers in their tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers in their tenant" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers in their tenant" ON public.suppliers;

-- Create RLS policies for suppliers
CREATE POLICY "Users can view suppliers in their tenant"
  ON public.suppliers FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create suppliers in their tenant"
  ON public.suppliers FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update suppliers in their tenant"
  ON public.suppliers FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete suppliers in their tenant"
  ON public.suppliers FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Add name column to accounting_integrations if it doesn't exist
ALTER TABLE public.accounting_integrations 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update expense_policy_rules to ensure supplier_id column exists
ALTER TABLE public.expense_policy_rules
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- Create index on supplier_id for expense_policy_rules
CREATE INDEX IF NOT EXISTS idx_expense_policy_rules_supplier_id 
ON public.expense_policy_rules(supplier_id);

-- Create index on tenant_id for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id 
ON public.suppliers(tenant_id);

-- Create index on is_active for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active 
ON public.suppliers(is_active) WHERE is_active = true;