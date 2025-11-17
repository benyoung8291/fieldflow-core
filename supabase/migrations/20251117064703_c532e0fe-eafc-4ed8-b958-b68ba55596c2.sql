
-- Drop the old constraint that prevents both customer_id and lead_id
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quote_customer_or_lead_check;

-- Add new constraint that allows:
-- 1. Quote with only customer_id (is_for_lead = false)
-- 2. Quote with only lead_id (is_for_lead = true)
-- 3. Quote with both customer_id and lead_id (converted lead, is_for_lead = true)
ALTER TABLE quotes ADD CONSTRAINT quote_customer_or_lead_check 
CHECK (
  (customer_id IS NOT NULL OR lead_id IS NOT NULL)
  AND
  (
    (is_for_lead = false AND customer_id IS NOT NULL) OR
    (is_for_lead = true AND lead_id IS NOT NULL)
  )
);

-- Update existing Insuro quote to link to customer while keeping lead reference
UPDATE quotes 
SET customer_id = '446d6d97-3855-4d0d-a5d2-e884cddb80ee'
WHERE id = '916aa525-75b9-49e9-8440-f1e4e74a798f';

-- Update the Insuro Pty Ltd lead to link to the customer
UPDATE leads 
SET 
  converted_to_customer_id = '446d6d97-3855-4d0d-a5d2-e884cddb80ee',
  converted_at = NOW()
WHERE id = '01ccc430-3715-4497-ac9d-2fd1894ba9dc';
