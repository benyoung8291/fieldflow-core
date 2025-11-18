-- Add cost_price to service_contract_line_items
ALTER TABLE service_contract_line_items 
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;

-- Add cost_price to service_order_line_items
ALTER TABLE service_order_line_items 
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;

-- Add tenant_id to service_contract_line_items (if missing)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_contract_line_items' 
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE service_contract_line_items 
    ADD COLUMN tenant_id uuid;
    
    -- Populate tenant_id from parent contract
    UPDATE service_contract_line_items scli
    SET tenant_id = sc.tenant_id
    FROM service_contracts sc
    WHERE scli.contract_id = sc.id
    AND scli.tenant_id IS NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE service_contract_line_items 
    ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;