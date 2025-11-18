-- Add service_order_id and project_id columns to purchase_orders if they don't exist
DO $$ 
BEGIN
  -- Add service_order_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_orders' 
    AND column_name = 'service_order_id'
  ) THEN
    ALTER TABLE public.purchase_orders 
    ADD COLUMN service_order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_service_order_id 
    ON public.purchase_orders(service_order_id);
  END IF;

  -- Add project_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_orders' 
    AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.purchase_orders 
    ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id 
    ON public.purchase_orders(project_id);
  END IF;
END $$;