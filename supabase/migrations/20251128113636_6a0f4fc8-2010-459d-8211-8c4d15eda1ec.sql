-- Create pdf_templates table for visual template builder
CREATE TABLE IF NOT EXISTS pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'purchase_order', 'invoice', 'field_report')),
  template_json JSONB NOT NULL DEFAULT '{}',
  page_settings JSONB NOT NULL DEFAULT '{"size": "A4", "orientation": "portrait", "margins": {"top": 20, "right": 20, "bottom": 20, "left": 20}}',
  thumbnail_url TEXT,
  is_default BOOLEAN DEFAULT false,
  include_sub_items BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create marketing_pages table
CREATE TABLE IF NOT EXISTS marketing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  page_type TEXT NOT NULL CHECK (page_type IN ('cover', 'terms', 'brochure', 'footer')),
  content_json JSONB NOT NULL DEFAULT '{}',
  page_order INTEGER DEFAULT 0,
  file_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create template_marketing_pages junction table
CREATE TABLE IF NOT EXISTS template_marketing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES pdf_templates(id) ON DELETE CASCADE,
  marketing_page_id UUID NOT NULL REFERENCES marketing_pages(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('before', 'after')),
  page_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, marketing_page_id)
);

-- Enable RLS
ALTER TABLE pdf_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_marketing_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pdf_templates
CREATE POLICY "Users can view templates in their tenant"
  ON pdf_templates FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create templates in their tenant"
  ON pdf_templates FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update templates in their tenant"
  ON pdf_templates FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete templates in their tenant"
  ON pdf_templates FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for marketing_pages
CREATE POLICY "Users can view marketing pages in their tenant"
  ON marketing_pages FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create marketing pages in their tenant"
  ON marketing_pages FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update marketing pages in their tenant"
  ON marketing_pages FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete marketing pages in their tenant"
  ON marketing_pages FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for template_marketing_pages
CREATE POLICY "Users can view template marketing page links"
  ON template_marketing_pages FOR SELECT
  USING (template_id IN (SELECT id FROM pdf_templates WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can create template marketing page links"
  ON template_marketing_pages FOR INSERT
  WITH CHECK (template_id IN (SELECT id FROM pdf_templates WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete template marketing page links"
  ON template_marketing_pages FOR DELETE
  USING (template_id IN (SELECT id FROM pdf_templates WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));

-- Create indexes
CREATE INDEX idx_pdf_templates_tenant ON pdf_templates(tenant_id);
CREATE INDEX idx_pdf_templates_type ON pdf_templates(document_type);
CREATE INDEX idx_marketing_pages_tenant ON marketing_pages(tenant_id);
CREATE INDEX idx_template_marketing_pages_template ON template_marketing_pages(template_id);