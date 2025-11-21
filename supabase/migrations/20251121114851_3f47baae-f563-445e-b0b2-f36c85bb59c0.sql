-- Add ABN validation columns to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS abn_validation_status text,
ADD COLUMN IF NOT EXISTS abn_validated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS abn_validation_error text;