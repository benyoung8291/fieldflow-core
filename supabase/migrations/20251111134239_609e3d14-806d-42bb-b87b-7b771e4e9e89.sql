-- Add display_order field for drag-and-drop ordering of linked documents
ALTER TABLE helpdesk_linked_documents 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add fields to store document display information
ALTER TABLE helpdesk_linked_documents
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_helpdesk_linked_documents_display_order 
ON helpdesk_linked_documents(ticket_id, display_order);

COMMENT ON COLUMN helpdesk_linked_documents.display_order IS 'Order for displaying linked documents in the sidebar (drag-and-drop)';
COMMENT ON COLUMN helpdesk_linked_documents.document_number IS 'Cached document number/identifier for display';
COMMENT ON COLUMN helpdesk_linked_documents.description IS 'Cached document description for display';
