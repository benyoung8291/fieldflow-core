-- Add key_number field to service_contract_line_items table
ALTER TABLE service_contract_line_items 
ADD COLUMN IF NOT EXISTS key_number text;