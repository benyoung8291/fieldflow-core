-- Drop existing entity_type check constraint if it exists
ALTER TABLE public.sequential_number_settings 
DROP CONSTRAINT IF EXISTS sequential_number_settings_entity_type_check;

-- Add new check constraint that includes purchase_order
ALTER TABLE public.sequential_number_settings
ADD CONSTRAINT sequential_number_settings_entity_type_check 
CHECK (entity_type IN ('quote', 'invoice', 'service_order', 'purchase_order'));

-- Ensure purchase_order entity type exists in sequential_number_settings for all tenants
INSERT INTO public.sequential_number_settings (tenant_id, entity_type, prefix, number_length, next_number)
SELECT 
  id as tenant_id,
  'purchase_order' as entity_type,
  'PO-' as prefix,
  6 as number_length,
  1 as next_number
FROM public.tenants
WHERE NOT EXISTS (
  SELECT 1 FROM public.sequential_number_settings 
  WHERE tenant_id = tenants.id AND entity_type = 'purchase_order'
);