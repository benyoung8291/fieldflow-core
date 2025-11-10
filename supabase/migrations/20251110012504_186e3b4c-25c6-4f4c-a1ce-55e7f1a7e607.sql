-- Create project_line_items table to store original quote line items
CREATE TABLE IF NOT EXISTS public.project_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL,
  parent_line_item_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  sell_price NUMERIC DEFAULT 0,
  margin_percentage NUMERIC DEFAULT 0,
  notes TEXT,
  price_book_item_id UUID,
  is_from_price_book BOOLEAN DEFAULT false,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add financial tracking columns to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS invoiced_to_date NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wip_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS labour_cost_total NUMERIC DEFAULT 0;

-- Update projects to set original_budget if not set
UPDATE public.projects 
SET original_budget = budget 
WHERE original_budget IS NULL AND budget IS NOT NULL;

-- Enable RLS
ALTER TABLE public.project_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_line_items
CREATE POLICY "Users can view project line items in their tenant"
  ON public.project_line_items FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create project line items in their tenant"
  ON public.project_line_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update project line items in their tenant"
  ON public.project_line_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete project line items in their tenant"
  ON public.project_line_items FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create indexes
CREATE INDEX idx_project_line_items_project ON public.project_line_items(project_id);
CREATE INDEX idx_project_line_items_parent ON public.project_line_items(parent_line_item_id);
CREATE INDEX idx_project_line_items_tenant ON public.project_line_items(tenant_id);

-- Update audit trigger for project_line_items
CREATE TRIGGER audit_project_line_items
  AFTER INSERT OR UPDATE OR DELETE ON public.project_line_items
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Update audit trigger for project_change_orders
CREATE TRIGGER audit_project_change_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.project_change_orders
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Update audit trigger for change_order_line_items
CREATE TRIGGER audit_change_order_line_items
  AFTER INSERT OR UPDATE OR DELETE ON public.change_order_line_items
  FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Trigger to update timestamps
CREATE TRIGGER update_project_line_items_updated_at
  BEFORE UPDATE ON public.project_line_items
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();