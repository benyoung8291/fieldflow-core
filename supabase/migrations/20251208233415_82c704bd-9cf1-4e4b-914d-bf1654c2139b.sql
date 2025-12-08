
-- Create location mapping table for Airtable import
CREATE TABLE public.airtable_location_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_auto_id TEXT,
  airtable_location_name TEXT,
  airtable_property TEXT,
  airtable_site_name TEXT,
  airtable_state TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  location_id UUID REFERENCES customer_locations(id) ON DELETE SET NULL,
  match_status TEXT DEFAULT 'pending',
  match_confidence NUMERIC,
  is_manually_mapped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, airtable_auto_id)
);

-- Create worker mapping table for Airtable import
CREATE TABLE public.airtable_worker_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_technician_name TEXT NOT NULL,
  worker_type TEXT,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  match_status TEXT DEFAULT 'pending',
  match_confidence NUMERIC,
  is_manually_mapped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, airtable_technician_name)
);

-- Add new columns to field_reports for legacy import and additional fields
ALTER TABLE public.field_reports
ADD COLUMN IF NOT EXISTS airtable_record_id TEXT,
ADD COLUMN IF NOT EXISTS is_legacy_import BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS legacy_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS subcontractor_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS carpet_condition_rating INTEGER,
ADD COLUMN IF NOT EXISTS hardfloor_condition_rating INTEGER,
ADD COLUMN IF NOT EXISTS swms_completed BOOLEAN,
ADD COLUMN IF NOT EXISTS test_tag_completed BOOLEAN,
ADD COLUMN IF NOT EXISTS equipment_good_order BOOLEAN,
ADD COLUMN IF NOT EXISTS furniture_quantity INTEGER,
ADD COLUMN IF NOT EXISTS flooring_sqm DECIMAL,
ADD COLUMN IF NOT EXISTS service_order_number_reference TEXT;

-- Add constraint for condition ratings
ALTER TABLE public.field_reports
ADD CONSTRAINT carpet_condition_rating_range CHECK (carpet_condition_rating IS NULL OR (carpet_condition_rating >= 1 AND carpet_condition_rating <= 5)),
ADD CONSTRAINT hardfloor_condition_rating_range CHECK (hardfloor_condition_rating IS NULL OR (hardfloor_condition_rating >= 1 AND hardfloor_condition_rating <= 5));

-- Enable RLS on mapping tables
ALTER TABLE public.airtable_location_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airtable_worker_mapping ENABLE ROW LEVEL SECURITY;

-- RLS policies for location mapping
CREATE POLICY "Users can view their tenant's location mappings"
ON public.airtable_location_mapping
FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert location mappings for their tenant"
ON public.airtable_location_mapping
FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant's location mappings"
ON public.airtable_location_mapping
FOR UPDATE
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their tenant's location mappings"
ON public.airtable_location_mapping
FOR DELETE
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- RLS policies for worker mapping
CREATE POLICY "Users can view their tenant's worker mappings"
ON public.airtable_worker_mapping
FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert worker mappings for their tenant"
ON public.airtable_worker_mapping
FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant's worker mappings"
ON public.airtable_worker_mapping
FOR UPDATE
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their tenant's worker mappings"
ON public.airtable_worker_mapping
FOR DELETE
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_airtable_location_mapping_tenant ON public.airtable_location_mapping(tenant_id);
CREATE INDEX idx_airtable_location_mapping_status ON public.airtable_location_mapping(match_status);
CREATE INDEX idx_airtable_worker_mapping_tenant ON public.airtable_worker_mapping(tenant_id);
CREATE INDEX idx_airtable_worker_mapping_status ON public.airtable_worker_mapping(match_status);
CREATE INDEX idx_field_reports_legacy ON public.field_reports(is_legacy_import) WHERE is_legacy_import = true;
