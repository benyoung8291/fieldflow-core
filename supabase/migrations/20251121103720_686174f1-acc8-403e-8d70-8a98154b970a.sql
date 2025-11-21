-- Add acumatica_supplier_id field to suppliers table
ALTER TABLE public.suppliers
ADD COLUMN acumatica_supplier_id text;