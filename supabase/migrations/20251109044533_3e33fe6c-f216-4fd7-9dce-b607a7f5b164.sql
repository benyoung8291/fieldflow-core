-- Add project_id to service_orders for project linking
ALTER TABLE public.service_orders 
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.customers(id);

-- Add comment to clarify project_id usage
COMMENT ON COLUMN public.service_orders.project_id IS 'Links service order to a parent project/customer';

-- Add trigger for service_orders audit logging
DROP TRIGGER IF EXISTS service_orders_audit_trigger ON public.service_orders;
CREATE TRIGGER service_orders_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();