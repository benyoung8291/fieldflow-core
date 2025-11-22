
-- Make appointment-files bucket public so images can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'appointment-files';
