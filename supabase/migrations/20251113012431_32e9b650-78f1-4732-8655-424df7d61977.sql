-- Create expense policy rules table
CREATE TABLE public.expense_policy_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'max_amount', 'restricted_vendor', 'prohibited_category'
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_amount NUMERIC,
  vendor_id UUID,
  category_id UUID,
  applies_to TEXT NOT NULL DEFAULT 'both', -- 'expenses', 'purchase_orders', 'both'
  violation_action TEXT NOT NULL DEFAULT 'flag', -- 'flag', 'block'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_policy_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view policy rules in their tenant"
  ON public.expense_policy_rules
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage policy rules"
  ON public.expense_policy_rules
  FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));

-- Add policy violation fields to expenses
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS policy_violations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_policy_compliant BOOLEAN DEFAULT true;

-- Add policy violation fields to purchase_orders
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS policy_violations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_policy_compliant BOOLEAN DEFAULT true;

-- Create index for policy checks
CREATE INDEX idx_expense_policy_rules_tenant ON public.expense_policy_rules(tenant_id, is_active);
CREATE INDEX idx_expenses_policy_compliance ON public.expenses(tenant_id, is_policy_compliant);
CREATE INDEX idx_purchase_orders_policy_compliance ON public.purchase_orders(tenant_id, is_policy_compliant);