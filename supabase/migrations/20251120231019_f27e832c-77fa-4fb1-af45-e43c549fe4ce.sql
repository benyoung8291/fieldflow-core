-- Add department field to customers table
ALTER TABLE customers 
ADD COLUMN department text;

COMMENT ON COLUMN customers.department IS 'Primary department customer works with (e.g., Cleaning, Flooring, Special Projects, Shared)';
