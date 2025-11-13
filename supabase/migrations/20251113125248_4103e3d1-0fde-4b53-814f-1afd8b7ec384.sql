-- Add estimated_hours column to service_contract_line_items
ALTER TABLE service_contract_line_items 
ADD COLUMN estimated_hours numeric DEFAULT 0;