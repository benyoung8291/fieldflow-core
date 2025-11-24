-- Add appointment_number field to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_number TEXT;

-- Create index on service_order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_service_order ON appointments(service_order_id);

-- Function to generate appointment number based on service order
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
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate appointment numbers
DROP TRIGGER IF EXISTS trigger_generate_appointment_number ON appointments;
CREATE TRIGGER trigger_generate_appointment_number
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION generate_appointment_number();

-- Backfill appointment numbers for existing appointments
DO $$
DECLARE
  v_appointment RECORD;
  v_service_order_number TEXT;
  v_sequence INT;
BEGIN
  FOR v_appointment IN 
    SELECT a.id, a.service_order_id, so.work_order_number,
           ROW_NUMBER() OVER (PARTITION BY a.service_order_id ORDER BY a.created_at) as seq
    FROM appointments a
    LEFT JOIN service_orders so ON a.service_order_id = so.id
    WHERE a.service_order_id IS NOT NULL
      AND (a.appointment_number IS NULL OR a.appointment_number = '')
    ORDER BY a.service_order_id, a.created_at
  LOOP
    IF v_appointment.work_order_number IS NOT NULL THEN
      UPDATE appointments
      SET appointment_number = v_appointment.work_order_number || '-' || v_appointment.seq
      WHERE id = v_appointment.id;
    END IF;
  END LOOP;
END $$;