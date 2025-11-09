-- Remove discount fields from quotes table
ALTER TABLE quotes DROP COLUMN IF EXISTS discount_amount;