
-- Fix security issue: Set search_path for the recalculate function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
