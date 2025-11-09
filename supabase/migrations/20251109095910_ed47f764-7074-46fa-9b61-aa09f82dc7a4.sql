-- Add customer_type column to customers table
ALTER TABLE customers ADD COLUMN customer_type text NOT NULL DEFAULT 'company' CHECK (customer_type IN ('individual', 'company'));