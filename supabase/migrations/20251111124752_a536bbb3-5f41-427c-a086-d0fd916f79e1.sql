-- Create helpdesk linked documents table
CREATE TABLE public.helpdesk_linked_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('service_order', 'appointment', 'quote', 'invoice', 'project', 'task')),
  document_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for ticket lookups
CREATE INDEX idx_helpdesk_linked_documents_ticket_id ON public.helpdesk_linked_documents(ticket_id);
CREATE INDEX idx_helpdesk_linked_documents_document ON public.helpdesk_linked_documents(document_type, document_id);

-- Enable RLS
ALTER TABLE public.helpdesk_linked_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view linked documents for their tenant"
ON public.helpdesk_linked_documents
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create linked documents for their tenant"
ON public.helpdesk_linked_documents
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete linked documents for their tenant"
ON public.helpdesk_linked_documents
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- Add attachments support to messages
ALTER TABLE public.helpdesk_messages
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;