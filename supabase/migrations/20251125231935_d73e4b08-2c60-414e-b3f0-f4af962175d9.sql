
-- Function to recalculate service order subtotal from line items
CREATE OR REPLACE FUNCTION recalculate_service_order_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE service_orders
  SET subtotal = COALESCE((
    SELECT SUM(line_total)
    FROM service_order_line_items
    WHERE service_order_id = COALESCE(NEW.service_order_id, OLD.service_order_id)
  ), 0),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.service_order_id, OLD.service_order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for INSERT on service_order_line_items
DROP TRIGGER IF EXISTS trigger_recalc_subtotal_on_insert ON service_order_line_items;
CREATE TRIGGER trigger_recalc_subtotal_on_insert
  AFTER INSERT ON service_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_service_order_subtotal();

-- Trigger for UPDATE on service_order_line_items
DROP TRIGGER IF EXISTS trigger_recalc_subtotal_on_update ON service_order_line_items;
CREATE TRIGGER trigger_recalc_subtotal_on_update
  AFTER UPDATE ON service_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_service_order_subtotal();

-- Trigger for DELETE on service_order_line_items
DROP TRIGGER IF EXISTS trigger_recalc_subtotal_on_delete ON service_order_line_items;
CREATE TRIGGER trigger_recalc_subtotal_on_delete
  AFTER DELETE ON service_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_service_order_subtotal();

-- Fix all existing service orders with incorrect subtotals
UPDATE service_orders so
SET subtotal = COALESCE((
  SELECT SUM(line_total)
  FROM service_order_line_items soli
  WHERE soli.service_order_id = so.id
), 0),
updated_at = NOW()
WHERE subtotal != COALESCE((
  SELECT SUM(line_total)
  FROM service_order_line_items soli
  WHERE soli.service_order_id = so.id
), 0) OR subtotal IS NULL;
