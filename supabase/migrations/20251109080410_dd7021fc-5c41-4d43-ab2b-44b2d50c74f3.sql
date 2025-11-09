-- Create menu_items table for custom navigation
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  path TEXT,
  parent_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL DEFAULT 0,
  is_folder BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view menu items in their tenant"
  ON public.menu_items FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create menu items in their tenant"
  ON public.menu_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update menu items in their tenant"
  ON public.menu_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete custom menu items in their tenant"
  ON public.menu_items FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND is_system = false);

-- Create trigger for updated_at
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes
CREATE INDEX idx_menu_items_tenant_id ON public.menu_items(tenant_id);
CREATE INDEX idx_menu_items_parent_id ON public.menu_items(parent_id);
CREATE INDEX idx_menu_items_order ON public.menu_items(item_order);