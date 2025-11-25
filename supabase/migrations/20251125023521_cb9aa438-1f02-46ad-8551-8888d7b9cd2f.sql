-- Create notes table for service orders, appointments, and projects
CREATE TABLE IF NOT EXISTS public.document_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('service_order', 'appointment', 'project')),
  document_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_sticky BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view notes in their tenant"
  ON public.document_notes
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create notes in their tenant"
  ON public.document_notes
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update notes in their tenant"
  ON public.document_notes
  FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete notes in their tenant"
  ON public.document_notes
  FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create index for faster queries
CREATE INDEX idx_document_notes_document ON public.document_notes(document_type, document_id);
CREATE INDEX idx_document_notes_sticky ON public.document_notes(is_sticky) WHERE is_sticky = true;

-- Create trigger to ensure only one sticky note per document
CREATE OR REPLACE FUNCTION ensure_single_sticky_note()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_sticky = true THEN
    -- Unset all other sticky notes for this document
    UPDATE public.document_notes
    SET is_sticky = false
    WHERE document_type = NEW.document_type
      AND document_id = NEW.document_id
      AND id != NEW.id
      AND is_sticky = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_sticky_note
  BEFORE INSERT OR UPDATE ON public.document_notes
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_sticky_note();