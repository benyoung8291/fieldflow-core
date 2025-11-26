-- Fix search_path for security
DROP TRIGGER IF EXISTS trigger_create_appointment_confirmation ON appointment_workers;
DROP TRIGGER IF EXISTS trigger_check_appointment_reconfirmation ON appointments;
DROP FUNCTION IF EXISTS create_appointment_confirmation();
DROP FUNCTION IF EXISTS check_appointment_reconfirmation();

-- Recreate with proper search_path
CREATE OR REPLACE FUNCTION create_appointment_confirmation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM appointments 
    WHERE id = NEW.appointment_id 
    AND status = 'published'
  ) THEN
    INSERT INTO appointment_worker_confirmations (
      tenant_id,
      appointment_id,
      worker_id,
      status
    )
    VALUES (
      NEW.tenant_id,
      NEW.appointment_id,
      NEW.worker_id,
      'pending'
    )
    ON CONFLICT (appointment_id, worker_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_appointment_reconfirmation()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.start_time IS DISTINCT FROM NEW.start_time OR 
     OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    
    UPDATE appointment_worker_confirmations
    SET 
      status = 'pending',
      notified_at = NULL,
      confirmed_at = NULL,
      last_appointment_start_time = OLD.start_time,
      last_appointment_end_time = OLD.end_time,
      updated_at = now()
    WHERE appointment_id = NEW.id
      AND status = 'confirmed';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_appointment_confirmation
  AFTER INSERT ON appointment_workers
  FOR EACH ROW
  EXECUTE FUNCTION create_appointment_confirmation();

CREATE TRIGGER trigger_check_appointment_reconfirmation
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION check_appointment_reconfirmation();