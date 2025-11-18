-- Add tracking fields to service_order_line_items to link them to contract line items
ALTER TABLE service_order_line_items
ADD COLUMN contract_line_item_id uuid REFERENCES service_contract_line_items(id) ON DELETE SET NULL,
ADD COLUMN generation_date date;

-- Create index for efficient lookups
CREATE INDEX idx_service_order_line_items_contract_tracking 
ON service_order_line_items(contract_line_item_id, generation_date) 
WHERE contract_line_item_id IS NOT NULL;