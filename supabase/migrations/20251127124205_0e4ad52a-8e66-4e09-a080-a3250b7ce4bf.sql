-- Function to generate field report numbers based on appointment number
CREATE OR REPLACE FUNCTION public.generate_field_report_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_number TEXT;
  v_sequence_number INT;
  v_report_number TEXT;
BEGIN
  -- Only generate if appointment_id exists and report_number is not set or is a draft number
  IF NEW.appointment_id IS NOT NULL AND (NEW.report_number IS NULL OR NEW.report_number LIKE 'FR-DRAFT-%') THEN
    -- Get appointment number
    SELECT appointment_number INTO v_appointment_number
    FROM appointments
    WHERE id = NEW.appointment_id;
    
    -- Get count of existing reports for this appointment (including this one if UPDATE)
    IF TG_OP = 'INSERT' THEN
      SELECT COUNT(*) + 1 INTO v_sequence_number
      FROM field_reports
      WHERE appointment_id = NEW.appointment_id
        AND report_number NOT LIKE 'FR-DRAFT-%';
    ELSE
      -- For UPDATE, recalculate if appointment changed or if converting from draft
      IF OLD.appointment_id IS DISTINCT FROM NEW.appointment_id OR OLD.report_number LIKE 'FR-DRAFT-%' THEN
        SELECT COUNT(*) + 1 INTO v_sequence_number
        FROM field_reports
        WHERE appointment_id = NEW.appointment_id
          AND report_number NOT LIKE 'FR-DRAFT-%'
          AND id != NEW.id;
      ELSE
        -- Keep existing report number if appointment didn't change
        RETURN NEW;
      END IF;
    END IF;
    
    -- Generate report number: appointment_number-sequence (e.g., SO-001-1-1, SO-001-1-2)
    IF v_appointment_number IS NOT NULL THEN
      v_report_number := v_appointment_number || '-' || v_sequence_number;
      NEW.report_number := v_report_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS set_field_report_number ON field_reports;

-- Create trigger that runs before insert or update
CREATE TRIGGER set_field_report_number
  BEFORE INSERT OR UPDATE ON field_reports
  FOR EACH ROW
  EXECUTE FUNCTION generate_field_report_number();