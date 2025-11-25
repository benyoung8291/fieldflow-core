-- Drop the incorrect foreign key
ALTER TABLE document_notes
DROP CONSTRAINT IF EXISTS document_notes_created_by_fkey;

-- Add correct foreign key to profiles table
ALTER TABLE document_notes
ADD CONSTRAINT document_notes_created_by_fkey
FOREIGN KEY (created_by) REFERENCES profiles(id)
ON DELETE CASCADE;