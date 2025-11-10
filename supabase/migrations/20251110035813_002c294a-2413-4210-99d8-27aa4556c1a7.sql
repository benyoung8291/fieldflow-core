-- Add billing status enum and columns
CREATE TYPE billing_status AS ENUM ('not_billed', 'partially_billed', 'billed');

ALTER TABLE service_orders
ADD COLUMN billing_status billing_status DEFAULT 'not_billed';

ALTER TABLE projects
ADD COLUMN billing_status billing_status DEFAULT 'not_billed';

-- Add progress invoice flag to invoices
ALTER TABLE invoices
ADD COLUMN is_progress_invoice BOOLEAN DEFAULT false;

-- Add line_item_id to track source line items
ALTER TABLE invoice_line_items
ADD COLUMN line_item_id UUID;

-- Add indexes
CREATE INDEX idx_invoice_line_items_line_item ON invoice_line_items(line_item_id);
CREATE INDEX idx_service_orders_billing_status ON service_orders(billing_status);
CREATE INDEX idx_projects_billing_status ON projects(billing_status);