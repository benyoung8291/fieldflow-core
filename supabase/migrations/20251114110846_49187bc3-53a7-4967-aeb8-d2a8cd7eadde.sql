-- Fix suppliers table and relationships

-- Ensure suppliers table exists with all necessary columns
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  trading_names TEXT[],
  abn TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  gst_registered BOOLEAN DEFAULT false,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  customer_id UUID REFERENCES public.customers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key from purchase_orders to suppliers if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_orders' 
    AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE public.purchase_orders ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id);
  END IF;
END $$;

-- Migrate vendor_id to supplier_id in purchase_orders if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_orders' 
    AND column_name = 'vendor_id'
  ) THEN
    UPDATE public.purchase_orders SET supplier_id = vendor_id WHERE supplier_id IS NULL;
  END IF;
END $$;

-- Fix expense_policy_rules to use supplier_id consistently
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'expense_policy_rules' 
    AND column_name = 'vendor_id'
  ) THEN
    -- Copy vendor_id data to supplier_id if supplier_id exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'expense_policy_rules' 
      AND column_name = 'supplier_id'
    ) THEN
      UPDATE public.expense_policy_rules SET supplier_id = vendor_id WHERE supplier_id IS NULL;
      ALTER TABLE public.expense_policy_rules DROP COLUMN vendor_id;
    ELSE
      -- Rename vendor_id to supplier_id
      ALTER TABLE public.expense_policy_rules RENAME COLUMN vendor_id TO supplier_id;
    END IF;
  END IF;
END $$;

-- Add foreign key constraint for supplier_id in contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'contacts_supplier_id_fkey'
    AND table_name = 'contacts'
  ) THEN
    ALTER TABLE public.contacts 
    ADD CONSTRAINT contacts_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key constraint for supplier_id in expense_policy_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'expense_policy_rules_supplier_id_fkey'
    AND table_name = 'expense_policy_rules'
  ) THEN
    ALTER TABLE public.expense_policy_rules 
    ADD CONSTRAINT expense_policy_rules_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure RLS is enabled on suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for suppliers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' 
    AND policyname = 'Users can view suppliers in their tenant'
  ) THEN
    CREATE POLICY "Users can view suppliers in their tenant"
      ON public.suppliers FOR SELECT
      USING (tenant_id = get_user_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' 
    AND policyname = 'Users can create suppliers in their tenant'
  ) THEN
    CREATE POLICY "Users can create suppliers in their tenant"
      ON public.suppliers FOR INSERT
      WITH CHECK (tenant_id = get_user_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' 
    AND policyname = 'Users can update suppliers in their tenant'
  ) THEN
    CREATE POLICY "Users can update suppliers in their tenant"
      ON public.suppliers FOR UPDATE
      USING (tenant_id = get_user_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'suppliers' 
    AND policyname = 'Users can delete suppliers in their tenant'
  ) THEN
    CREATE POLICY "Users can delete suppliers in their tenant"
      ON public.suppliers FOR DELETE
      USING (tenant_id = get_user_tenant_id());
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_customer_id ON public.suppliers(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expense_policy_rules_supplier_id ON public.expense_policy_rules(supplier_id);