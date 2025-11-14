-- Add cost tracking fields to service_orders for P&L calculations
ALTER TABLE service_orders 
ADD COLUMN IF NOT EXISTS actual_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_of_materials numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_of_labor numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_costs numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin numeric GENERATED ALWAYS AS (
  CASE 
    WHEN total_amount > 0 
    THEN ((total_amount - COALESCE(actual_cost, 0)) / total_amount) * 100
    ELSE 0
  END
) STORED;

COMMENT ON COLUMN service_orders.actual_cost IS 'Total actual cost from purchase orders and expenses';
COMMENT ON COLUMN service_orders.cost_of_materials IS 'Cost of materials from purchase orders';
COMMENT ON COLUMN service_orders.cost_of_labor IS 'Cost of labor from time logs';
COMMENT ON COLUMN service_orders.other_costs IS 'Other miscellaneous costs';
COMMENT ON COLUMN service_orders.profit_margin IS 'Calculated profit margin percentage';

-- Create function to recalculate service order costs from linked purchase orders
CREATE OR REPLACE FUNCTION recalculate_service_order_costs(p_service_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_po_total NUMERIC;
  v_labor_cost NUMERIC;
BEGIN
  -- Calculate total from approved purchase orders
  SELECT COALESCE(SUM(total_amount), 0) INTO v_po_total
  FROM purchase_orders
  WHERE service_order_id = p_service_order_id
    AND status IN ('approved', 'received');
  
  -- Calculate labor cost from time logs
  SELECT COALESCE(SUM(total_cost), 0) INTO v_labor_cost
  FROM time_logs
  WHERE service_order_id = p_service_order_id;
  
  -- Update service order
  UPDATE service_orders
  SET 
    cost_of_materials = v_po_total,
    cost_of_labor = v_labor_cost,
    actual_cost = v_po_total + v_labor_cost + COALESCE(other_costs, 0),
    updated_at = NOW()
  WHERE id = p_service_order_id;
END;
$$;

-- Create trigger to update service order costs when purchase order changes
CREATE OR REPLACE FUNCTION update_service_order_costs_from_po()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update costs when PO is linked to a service order
  IF NEW.service_order_id IS NOT NULL THEN
    PERFORM recalculate_service_order_costs(NEW.service_order_id);
  END IF;
  
  -- Also update old service order if it changed
  IF TG_OP = 'UPDATE' AND OLD.service_order_id IS DISTINCT FROM NEW.service_order_id AND OLD.service_order_id IS NOT NULL THEN
    PERFORM recalculate_service_order_costs(OLD.service_order_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_service_order_costs_po_trigger ON purchase_orders;
CREATE TRIGGER update_service_order_costs_po_trigger
AFTER INSERT OR UPDATE OF total_amount, status, service_order_id
ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_service_order_costs_from_po();