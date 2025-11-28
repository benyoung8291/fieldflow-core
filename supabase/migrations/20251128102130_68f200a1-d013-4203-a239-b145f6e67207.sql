-- Create document_templates table for Word document templates
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'purchase_order', 'invoice')),
  template_file_url TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  extracted_placeholders JSONB DEFAULT '[]'::jsonb,
  field_mappings JSONB DEFAULT '{}'::jsonb,
  include_sub_items BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_document_templates_tenant_type ON document_templates(tenant_id, document_type);
CREATE INDEX idx_document_templates_default ON document_templates(tenant_id, document_type, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view templates in their tenant"
  ON document_templates FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create templates in their tenant"
  ON document_templates FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update templates in their tenant"
  ON document_templates FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete templates in their tenant"
  ON document_templates FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Create storage bucket for document templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for document-templates bucket
CREATE POLICY "Users can upload templates to their tenant folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can view templates in their tenant folder"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update templates in their tenant folder"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete templates in their tenant folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'document-templates'
    AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
  );