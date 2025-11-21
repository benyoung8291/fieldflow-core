-- Add ABN validation status tracking to customers
ALTER TABLE customers 
ADD COLUMN abn_validation_status text CHECK (abn_validation_status IN ('pending', 'valid', 'invalid')),
ADD COLUMN abn_validation_error text,
ADD COLUMN abn_validated_at timestamptz;

-- Add index for filtering customers needing validation
CREATE INDEX idx_customers_abn_validation_status ON customers(abn_validation_status) WHERE abn_validation_status = 'pending';

-- Add comment
COMMENT ON COLUMN customers.abn_validation_status IS 'Status of ABN validation: pending (awaiting validation), valid (validated successfully), invalid (failed validation), or null (no ABN provided)';
COMMENT ON COLUMN customers.abn_validation_error IS 'Error message from ABN validation if validation failed';
COMMENT ON COLUMN customers.abn_validated_at IS 'Timestamp when ABN was last validated';