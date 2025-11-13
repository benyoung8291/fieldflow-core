-- Add cross-reference fields to link customers and vendors
ALTER TABLE customers
ADD COLUMN vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;

ALTER TABLE vendors
ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX idx_customers_vendor_id ON customers(vendor_id);
CREATE INDEX idx_vendors_customer_id ON vendors(customer_id);

-- Add helpful comments
COMMENT ON COLUMN customers.vendor_id IS 'Reference to vendor record if this customer is also a supplier';
COMMENT ON COLUMN vendors.customer_id IS 'Reference to customer record if this vendor is also a customer';