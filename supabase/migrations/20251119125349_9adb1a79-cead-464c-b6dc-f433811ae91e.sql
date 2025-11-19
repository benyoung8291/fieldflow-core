-- Add Acumatica contact ID fields to customers and suppliers tables
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS acumatica_customer_id text;

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS acumatica_vendor_id text;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_acumatica_id ON public.customers(acumatica_customer_id) WHERE acumatica_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_acumatica_id ON public.suppliers(acumatica_vendor_id) WHERE acumatica_vendor_id IS NOT NULL;