-- Add projects_service_orders_integration column to tenant_settings
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS projects_service_orders_integration BOOLEAN DEFAULT false;