-- Add the missing source_contract_line_item_id column to service_order_line_items
ALTER TABLE service_order_line_items 
ADD COLUMN IF NOT EXISTS source_contract_line_item_id UUID REFERENCES service_contract_line_items(id);