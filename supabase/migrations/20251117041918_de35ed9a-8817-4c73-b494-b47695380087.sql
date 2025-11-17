-- Make customer_id nullable so quotes can be created for leads without customers
ALTER TABLE quotes ALTER COLUMN customer_id DROP NOT NULL;

-- Add a check constraint to ensure either customer_id or lead_id is present
ALTER TABLE quotes ADD CONSTRAINT quotes_customer_or_lead_check 
  CHECK (customer_id IS NOT NULL OR lead_id IS NOT NULL);