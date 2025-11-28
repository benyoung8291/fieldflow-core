-- Remove the incorrectly named bucket
DELETE FROM storage.buckets WHERE id = 'document_templates';