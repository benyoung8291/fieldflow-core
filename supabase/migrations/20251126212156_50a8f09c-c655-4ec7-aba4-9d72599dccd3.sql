-- Create appointment worker confirmations table
CREATE TABLE IF NOT EXISTS appointment_worker_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  notified_at timestamptz,
  confirmed_at timestamptz,
  last_appointment_start_time timestamptz,
  last_appointment_end_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(appointment_id, worker_id)
);

-- Enable RLS
ALTER TABLE appointment_worker_confirmations ENABLE ROW LEVEL SECURITY;

-- Policy for workers to view and update their own confirmations
CREATE POLICY "Workers can view their confirmations"
  ON appointment_worker_confirmations
  FOR SELECT
  USING (
    worker_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('tenant_admin', 'supervisor')
      AND tenant_id = appointment_worker_confirmations.tenant_id
    )
  );

CREATE POLICY "Workers can update their confirmations"
  ON appointment_worker_confirmations
  FOR UPDATE
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- Policy for admins/supervisors to manage confirmations
CREATE POLICY "Admins can manage confirmations"
  ON appointment_worker_confirmations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('tenant_admin', 'supervisor')
      AND tenant_id = appointment_worker_confirmations.tenant_id
    )
  );

-- Index for performance
CREATE INDEX idx_appointment_worker_confirmations_appointment 
  ON appointment_worker_confirmations(appointment_id);
CREATE INDEX idx_appointment_worker_confirmations_worker 
  ON appointment_worker_confirmations(worker_id);
CREATE INDEX idx_appointment_worker_confirmations_status 
  ON appointment_worker_confirmations(status);

-- Function to create confirmation records when workers are assigned
CREATE OR REPLACE FUNCTION create_appointment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create confirmation for published appointments
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on appointment_workers table
CREATE TRIGGER trigger_create_appointment_confirmation
  AFTER INSERT ON appointment_workers
  FOR EACH ROW
  EXECUTE FUNCTION create_appointment_confirmation();

-- Function to check if appointment needs re-confirmation
CREATE OR REPLACE FUNCTION check_appointment_reconfirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- If start_time or end_time changed significantly (more than 15 minutes)
  IF OLD.start_time IS DISTINCT FROM NEW.start_time OR 
     OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    
    -- Reset confirmations to pending if time changed
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on appointments table
CREATE TRIGGER trigger_check_appointment_reconfirmation
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION check_appointment_reconfirmation();