-- Fix function search path for generate_appointment_number
CREATE OR REPLACE FUNCTION generate_appointment_number()
RETURNS TRIGGER AS $$
DECLARE
  v_service_order_number TEXT;
  v_sequence_number INT;
  v_appointment_number TEXT;
BEGIN
  -- Only generate if service_order_id exists and appointment_number is not set
  IF NEW.service_order_id IS NOT NULL AND (NEW.appointment_number IS NULL OR NEW.appointment_number = '') THEN
    -- Get service order work_order_number
    SELECT work_order_number INTO v_service_order_number
    FROM service_orders
    WHERE id = NEW.service_order_id;
    
    -- Get count of existing appointments for this service order (including this one if UPDATE)
    IF TG_OP = 'INSERT' THEN
      SELECT COUNT(*) + 1 INTO v_sequence_number
      FROM appointments
      WHERE service_order_id = NEW.service_order_id;
    ELSE
      -- For UPDATE, if service_order_id changed, recalculate
      IF OLD.service_order_id IS DISTINCT FROM NEW.service_order_id THEN
        SELECT COUNT(*) + 1 INTO v_sequence_number
        FROM appointments
        WHERE service_order_id = NEW.service_order_id;
      ELSE
        -- Keep existing appointment number if service order didn't change
        RETURN NEW;
      END IF;
    END IF;
    
    -- Generate appointment number
    IF v_service_order_number IS NOT NULL THEN
      v_appointment_number := v_service_order_number || '-' || v_sequence_number;
      NEW.appointment_number := v_appointment_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';