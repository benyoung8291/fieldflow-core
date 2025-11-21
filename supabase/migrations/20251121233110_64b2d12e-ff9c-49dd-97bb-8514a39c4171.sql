-- Create field_reports table
CREATE TABLE public.field_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.customer_locations(id) ON DELETE SET NULL,
  
  -- Report metadata
  report_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  
  -- Basic info
  worker_name TEXT NOT NULL,
  service_date DATE NOT NULL,
  arrival_time TIME NOT NULL,
  work_order_number TEXT,
  
  -- Condition ratings (1-5)
  carpet_condition_arrival INTEGER CHECK (carpet_condition_arrival BETWEEN 1 AND 5),
  hard_floor_condition_arrival INTEGER CHECK (hard_floor_condition_arrival BETWEEN 1 AND 5),
  flooring_state_description TEXT,
  
  -- Safety checks
  has_signed_swms BOOLEAN NOT NULL DEFAULT false,
  equipment_tested_tagged BOOLEAN NOT NULL DEFAULT false,
  equipment_clean_working BOOLEAN NOT NULL DEFAULT false,
  
  -- Work description
  work_description TEXT NOT NULL,
  internal_notes TEXT,
  
  -- Problem areas
  had_problem_areas BOOLEAN NOT NULL DEFAULT false,
  problem_areas_description TEXT,
  methods_attempted TEXT,
  
  -- Incidents
  had_incident BOOLEAN NOT NULL DEFAULT false,
  incident_description TEXT,
  
  -- Customer signature
  customer_signature_data TEXT,
  customer_signature_name TEXT,
  customer_signature_date TIMESTAMP WITH TIME ZONE,
  
  -- PDF generation
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE
);

-- Create field_report_photos table with before/after linking
CREATE TABLE public.field_report_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  field_report_id UUID NOT NULL REFERENCES public.field_reports(id) ON DELETE CASCADE,
  
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  
  photo_type TEXT NOT NULL CHECK (photo_type IN ('before', 'after', 'general', 'issue', 'equipment')),
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Before/after pairing
  paired_photo_id UUID REFERENCES public.field_report_photos(id) ON DELETE SET NULL,
  
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL,
  
  CONSTRAINT unique_pair_constraint UNIQUE NULLS NOT DISTINCT (field_report_id, paired_photo_id)
);

-- Enable RLS
ALTER TABLE public.field_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_report_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for field_reports
CREATE POLICY "Users can view reports in their tenant"
  ON public.field_reports FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create reports in their tenant"
  ON public.field_reports FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update reports in their tenant"
  ON public.field_reports FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Supervisors can delete reports"
  ON public.field_reports FOR DELETE
  USING (
    tenant_id = get_user_tenant_id() AND 
    (has_role(auth.uid(), 'supervisor'::user_role) OR has_role(auth.uid(), 'tenant_admin'::user_role))
  );

-- RLS policies for field_report_photos
CREATE POLICY "Users can view photos in their tenant"
  ON public.field_report_photos FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create photos in their tenant"
  ON public.field_report_photos FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update photos in their tenant"
  ON public.field_report_photos FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete photos in their tenant"
  ON public.field_report_photos FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create indexes
CREATE INDEX idx_field_reports_tenant ON public.field_reports(tenant_id);
CREATE INDEX idx_field_reports_appointment ON public.field_reports(appointment_id);
CREATE INDEX idx_field_reports_service_order ON public.field_reports(service_order_id);
CREATE INDEX idx_field_reports_customer ON public.field_reports(customer_id);
CREATE INDEX idx_field_reports_status ON public.field_reports(status);
CREATE INDEX idx_field_report_photos_report ON public.field_report_photos(field_report_id);
CREATE INDEX idx_field_report_photos_paired ON public.field_report_photos(paired_photo_id) WHERE paired_photo_id IS NOT NULL;