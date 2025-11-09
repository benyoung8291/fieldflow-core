-- Add assemblies (prebuilt line items with sub-items)
CREATE TABLE public.price_book_assemblies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Assembly line items
CREATE TABLE public.price_book_assembly_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id uuid NOT NULL REFERENCES public.price_book_assemblies(id) ON DELETE CASCADE,
  price_book_item_id uuid REFERENCES public.price_book_items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  cost_price numeric NOT NULL DEFAULT 0,
  margin_percentage numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL DEFAULT 0,
  item_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Quote version history
CREATE TABLE public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  version_number integer NOT NULL,
  title text NOT NULL,
  description text,
  subtotal numeric NOT NULL,
  tax_rate numeric NOT NULL,
  tax_amount numeric NOT NULL,
  discount_amount numeric NOT NULL,
  total_amount numeric NOT NULL,
  quote_type text NOT NULL,
  line_items jsonb NOT NULL,
  notes text,
  terms_conditions text,
  changed_by uuid NOT NULL,
  change_description text,
  created_at timestamptz DEFAULT now()
);

-- Quote attachments
CREATE TABLE public.quote_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  uploaded_by uuid NOT NULL,
  is_internal boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN is_archived boolean DEFAULT false,
ADD COLUMN archived_at timestamptz,
ADD COLUMN archived_by uuid,
ADD COLUMN internal_notes text,
ADD COLUMN duplicated_from_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.price_book_assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_book_assembly_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for price_book_assemblies
CREATE POLICY "Users can view assemblies in their tenant"
ON public.price_book_assemblies FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create assemblies in their tenant"
ON public.price_book_assemblies FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update assemblies in their tenant"
ON public.price_book_assemblies FOR UPDATE
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete assemblies in their tenant"
ON public.price_book_assemblies FOR DELETE
USING (tenant_id = get_user_tenant_id());

-- Create policies for price_book_assembly_items
CREATE POLICY "Users can view assembly items in their tenant"
ON public.price_book_assembly_items FOR SELECT
USING (assembly_id IN (SELECT id FROM public.price_book_assemblies WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can create assembly items in their tenant"
ON public.price_book_assembly_items FOR INSERT
WITH CHECK (assembly_id IN (SELECT id FROM public.price_book_assemblies WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can update assembly items in their tenant"
ON public.price_book_assembly_items FOR UPDATE
USING (assembly_id IN (SELECT id FROM public.price_book_assemblies WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can delete assembly items in their tenant"
ON public.price_book_assembly_items FOR DELETE
USING (assembly_id IN (SELECT id FROM public.price_book_assemblies WHERE tenant_id = get_user_tenant_id()));

-- Create policies for quote_versions
CREATE POLICY "Users can view versions in their tenant"
ON public.quote_versions FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create versions in their tenant"
ON public.quote_versions FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- Create policies for quote_attachments
CREATE POLICY "Users can view attachments in their tenant"
ON public.quote_attachments FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create attachments in their tenant"
ON public.quote_attachments FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete attachments in their tenant"
ON public.quote_attachments FOR DELETE
USING (tenant_id = get_user_tenant_id());

-- Create triggers
CREATE TRIGGER update_price_book_assemblies_updated_at
BEFORE UPDATE ON public.price_book_assemblies
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes
CREATE INDEX idx_price_book_assembly_items_assembly ON public.price_book_assembly_items(assembly_id);
CREATE INDEX idx_quote_versions_quote ON public.quote_versions(quote_id);
CREATE INDEX idx_quote_attachments_quote ON public.quote_attachments(quote_id);
CREATE UNIQUE INDEX idx_price_book_assemblies_code_tenant ON public.price_book_assemblies(tenant_id, code);