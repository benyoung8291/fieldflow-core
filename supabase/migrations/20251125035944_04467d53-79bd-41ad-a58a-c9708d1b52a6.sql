-- Add foreign key relationship for document_notes.created_by
ALTER TABLE document_notes
ADD CONSTRAINT document_notes_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id)
ON DELETE CASCADE;