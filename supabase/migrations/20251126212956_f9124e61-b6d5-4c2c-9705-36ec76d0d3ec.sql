-- Add decline_reason column to appointment_worker_confirmations
ALTER TABLE appointment_worker_confirmations 
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

COMMENT ON COLUMN appointment_worker_confirmations.decline_reason IS 'Reason provided by worker when declining an appointment assignment';