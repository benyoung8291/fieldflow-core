-- Add complex quoting fields to quote_line_items
ALTER TABLE public.quote_line_items
ADD COLUMN parent_line_item_id uuid REFERENCES public.quote_line_items(id) ON DELETE CASCADE,
ADD COLUMN cost_price numeric DEFAULT 0,
ADD COLUMN margin_percentage numeric DEFAULT 0,
ADD COLUMN sell_price numeric DEFAULT 0,
ADD COLUMN is_from_price_book boolean DEFAULT false,
ADD COLUMN price_book_item_id uuid;

-- Create index for parent-child relationship
CREATE INDEX idx_quote_line_items_parent ON public.quote_line_items(parent_line_item_id);

-- Create price book items table
CREATE TABLE public.price_book_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  description text NOT NULL,
  unit text DEFAULT 'each',
  cost_price numeric NOT NULL DEFAULT 0,
  margin_percentage numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL DEFAULT 0,
  category text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_book_items ENABLE ROW LEVEL SECURITY;

-- Create policies for price_book_items
CREATE POLICY "Users can view price book items in their tenant"
ON public.price_book_items FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create price book items in their tenant"
ON public.price_book_items FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update price book items in their tenant"
ON public.price_book_items FOR UPDATE
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete price book items in their tenant"
ON public.price_book_items FOR DELETE
USING (tenant_id = get_user_tenant_id());

-- Create trigger for updated_at
CREATE TRIGGER update_price_book_items_updated_at
BEFORE UPDATE ON public.price_book_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create unique constraint on code per tenant
CREATE UNIQUE INDEX idx_price_book_items_code_tenant ON public.price_book_items(tenant_id, code);