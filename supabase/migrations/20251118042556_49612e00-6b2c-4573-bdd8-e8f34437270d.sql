-- Add contract_id column to service_orders table to track which service contract generated the order
ALTER TABLE service_orders 
ADD COLUMN contract_id UUID REFERENCES service_contracts(id) ON DELETE SET NULL;