-- Update the create_appointment_confirmation function to skip subcontractors
-- Subcontractors have contact_id but no worker_id, and don't need confirmation records
CREATE OR REPLACE FUNCTION public.create_appointment_confirmation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create confirmation for internal workers (not subcontractors)
  -- Subcontractors have contact_id but no worker_id
  IF NEW.worker_id IS NOT NULL THEN
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
  END IF;
  -- For subcontractors (contact_id only), no confirmation record is created
  -- as they are managed through their supplier company
  RETURN NEW;
END;
$$;