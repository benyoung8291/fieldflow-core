-- Create service_order_line_items table
CREATE TABLE IF NOT EXISTS public.service_order_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  price_book_item_id UUID,
  is_from_price_book BOOLEAN DEFAULT false,
  parent_line_item_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_order_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_order_line_items
CREATE POLICY "Users can view line items in their tenant"
ON public.service_order_line_items
FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create line items in their tenant"
ON public.service_order_line_items
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update line items in their tenant"
ON public.service_order_line_items
FOR UPDATE
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete line items in their tenant"
ON public.service_order_line_items
FOR DELETE
USING (tenant_id = get_user_tenant_id());

-- Add new fields to service_orders and remove old ones
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS customer_location_id UUID REFERENCES public.customer_locations(id),
  ADD COLUMN IF NOT EXISTS customer_contact_id UUID REFERENCES public.customer_contacts(id),
  ADD COLUMN IF NOT EXISTS work_order_number TEXT,
  ADD COLUMN IF NOT EXISTS purchase_order_number TEXT,
  ADD COLUMN IF NOT EXISTS preferred_date_start DATE,
  ADD COLUMN IF NOT EXISTS preferred_date_end DATE,
  ADD COLUMN IF NOT EXISTS preferred_date DATE,
  ADD COLUMN IF NOT EXISTS skill_required TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

-- Remove old fields (in separate statements to avoid issues if they don't exist)
ALTER TABLE public.service_orders DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE public.service_orders DROP COLUMN IF EXISTS hourly_rate;
ALTER TABLE public.service_orders DROP COLUMN IF EXISTS scheduled_date;

-- Update billing_type to default to 'fixed' and make it non-nullable
UPDATE public.service_orders SET billing_type = 'fixed' WHERE billing_type IS NULL;
ALTER TABLE public.service_orders ALTER COLUMN billing_type SET DEFAULT 'fixed';

-- Create trigger for service_order_line_items updated_at
CREATE TRIGGER update_service_order_line_items_updated_at
BEFORE UPDATE ON public.service_order_line_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create audit log trigger for service_order_line_items
CREATE TRIGGER audit_service_order_line_items
AFTER INSERT OR UPDATE OR DELETE ON public.service_order_line_items
FOR EACH ROW
EXECUTE FUNCTION public.log_audit_trail();