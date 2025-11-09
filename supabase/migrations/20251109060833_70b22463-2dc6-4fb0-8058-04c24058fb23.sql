-- Add quote_type field to quotes table
ALTER TABLE public.quotes
ADD COLUMN quote_type text DEFAULT 'simple' CHECK (quote_type IN ('simple', 'complex'));