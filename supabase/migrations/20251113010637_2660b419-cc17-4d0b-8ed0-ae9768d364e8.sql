-- Create expense categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  expense_number TEXT NOT NULL,
  vendor_id UUID,
  category_id UUID,
  service_order_id UUID,
  project_id UUID,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference_number TEXT,
  account_code TEXT,
  sub_account TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense attachments table
CREATE TABLE IF NOT EXISTS public.expense_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  expense_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Users can view categories in their tenant"
  ON public.expense_categories FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create categories in their tenant"
  ON public.expense_categories FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update categories in their tenant"
  ON public.expense_categories FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete categories in their tenant"
  ON public.expense_categories FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses in their tenant"
  ON public.expenses FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create expenses in their tenant"
  ON public.expenses FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update expenses in their tenant"
  ON public.expenses FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete expenses in their tenant"
  ON public.expenses FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for expense_attachments
CREATE POLICY "Users can view attachments in their tenant"
  ON public.expense_attachments FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create attachments in their tenant"
  ON public.expense_attachments FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete attachments in their tenant"
  ON public.expense_attachments FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create indexes
CREATE INDEX idx_expense_categories_tenant ON public.expense_categories(tenant_id);
CREATE INDEX idx_expenses_tenant ON public.expenses(tenant_id);
CREATE INDEX idx_expenses_vendor ON public.expenses(vendor_id);
CREATE INDEX idx_expenses_category ON public.expenses(category_id);
CREATE INDEX idx_expenses_service_order ON public.expenses(service_order_id);
CREATE INDEX idx_expenses_project ON public.expenses(project_id);
CREATE INDEX idx_expense_attachments_expense ON public.expense_attachments(expense_id);

-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for expense receipts
CREATE POLICY "Users can view receipts in their tenant"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'expense-receipts' AND auth.uid() IN (
    SELECT id FROM profiles WHERE tenant_id IN (
      SELECT tenant_id FROM expenses WHERE id::text = (storage.foldername(name))[1]
    )
  ));

CREATE POLICY "Users can upload receipts in their tenant"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IN (
    SELECT id FROM profiles WHERE tenant_id IN (
      SELECT tenant_id FROM expenses WHERE id::text = (storage.foldername(name))[1]
    )
  ));

CREATE POLICY "Users can delete receipts in their tenant"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'expense-receipts' AND auth.uid() IN (
    SELECT id FROM profiles WHERE tenant_id IN (
      SELECT tenant_id FROM expenses WHERE id::text = (storage.foldername(name))[1]
    )
  ));