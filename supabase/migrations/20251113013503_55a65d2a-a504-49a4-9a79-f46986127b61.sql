-- Create company_credit_cards table
CREATE TABLE IF NOT EXISTS public.company_credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  card_name TEXT NOT NULL,
  card_provider TEXT NOT NULL, -- 'amex', 'visa', 'mastercard', etc.
  last_four_digits TEXT NOT NULL,
  full_card_number TEXT, -- For matching in transaction descriptions
  assigned_to UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create credit_card_transactions table
CREATE TABLE IF NOT EXISTS public.credit_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  external_id TEXT NOT NULL, -- ID from accounting system
  card_id UUID REFERENCES public.company_credit_cards(id),
  assigned_to UUID REFERENCES auth.users(id),
  expense_id UUID REFERENCES public.expenses(id),
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  merchant_name TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'unreconciled', -- 'unreconciled', 'reconciled', 'synced'
  is_assigned BOOLEAN NOT NULL DEFAULT false,
  sync_source TEXT NOT NULL, -- 'xero' or 'acumatica'
  external_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, external_id, sync_source)
);

-- Enable RLS
ALTER TABLE public.company_credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_credit_cards
CREATE POLICY "Users can view cards in their tenant"
  ON public.company_credit_cards FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage cards"
  ON public.company_credit_cards FOR ALL
  USING (
    tenant_id = get_user_tenant_id() AND 
    has_role(auth.uid(), 'tenant_admin'::user_role)
  );

-- RLS Policies for credit_card_transactions
CREATE POLICY "Users can view their assigned transactions"
  ON public.credit_card_transactions FOR SELECT
  USING (
    tenant_id = get_user_tenant_id() AND 
    (assigned_to = auth.uid() OR has_role(auth.uid(), 'tenant_admin'::user_role))
  );

CREATE POLICY "Users can update their assigned transactions"
  ON public.credit_card_transactions FOR UPDATE
  USING (
    tenant_id = get_user_tenant_id() AND 
    (assigned_to = auth.uid() OR has_role(auth.uid(), 'tenant_admin'::user_role))
  );

CREATE POLICY "Admins can manage all transactions"
  ON public.credit_card_transactions FOR ALL
  USING (
    tenant_id = get_user_tenant_id() AND 
    has_role(auth.uid(), 'tenant_admin'::user_role)
  );

-- Create indexes
CREATE INDEX idx_credit_card_transactions_assigned_to ON public.credit_card_transactions(assigned_to);
CREATE INDEX idx_credit_card_transactions_card_id ON public.credit_card_transactions(card_id);
CREATE INDEX idx_credit_card_transactions_status ON public.credit_card_transactions(status);
CREATE INDEX idx_credit_card_transactions_expense_id ON public.credit_card_transactions(expense_id);
CREATE INDEX idx_company_credit_cards_assigned_to ON public.company_credit_cards(assigned_to);