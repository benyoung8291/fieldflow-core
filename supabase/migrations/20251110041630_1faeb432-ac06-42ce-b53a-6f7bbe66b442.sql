-- Add ready_for_billing field to service_orders
ALTER TABLE public.service_orders 
ADD COLUMN IF NOT EXISTS ready_for_billing boolean DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_service_orders_ready_for_billing 
ON public.service_orders(tenant_id, status, ready_for_billing) 
WHERE status = 'completed';