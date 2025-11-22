-- Add edit tracking to time_logs table
ALTER TABLE time_logs
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edit_count integer DEFAULT 0;

-- Create time_log_edit_history table
CREATE TABLE IF NOT EXISTS time_log_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_log_id uuid NOT NULL REFERENCES time_logs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL REFERENCES auth.users(id),
  edited_at timestamp with time zone NOT NULL DEFAULT now(),
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  edit_reason text,
  CONSTRAINT fk_time_log FOREIGN KEY (time_log_id) REFERENCES time_logs(id) ON DELETE CASCADE
);

-- Enable RLS on time_log_edit_history
ALTER TABLE time_log_edit_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for time_log_edit_history
CREATE POLICY "Users can view edit history in their tenant"
  ON time_log_edit_history
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert edit history"
  ON time_log_edit_history
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Create function to log time log edits
CREATE OR REPLACE FUNCTION log_time_log_edit()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Get current user and tenant
  v_user_id := auth.uid();
  v_tenant_id := NEW.tenant_id;
  
  -- Only log if this is an update (not insert)
  IF TG_OP = 'UPDATE' THEN
    -- Update edit tracking fields
    NEW.edited_at := now();
    NEW.edited_by := v_user_id;
    NEW.edit_count := COALESCE(OLD.edit_count, 0) + 1;
    
    -- Log clock_in changes
    IF OLD.clock_in IS DISTINCT FROM NEW.clock_in THEN
      INSERT INTO time_log_edit_history (
        time_log_id,
        tenant_id,
        edited_by,
        field_changed,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        v_tenant_id,
        v_user_id,
        'clock_in',
        OLD.clock_in::text,
        NEW.clock_in::text
      );
    END IF;
    
    -- Log clock_out changes
    IF OLD.clock_out IS DISTINCT FROM NEW.clock_out THEN
      INSERT INTO time_log_edit_history (
        time_log_id,
        tenant_id,
        edited_by,
        field_changed,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        v_tenant_id,
        v_user_id,
        'clock_out',
        OLD.clock_out::text,
        NEW.clock_out::text
      );
    END IF;
    
    -- Log notes changes
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      INSERT INTO time_log_edit_history (
        time_log_id,
        tenant_id,
        edited_by,
        field_changed,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        v_tenant_id,
        v_user_id,
        'notes',
        OLD.notes,
        NEW.notes
      );
    END IF;
    
    -- Log hourly_rate changes
    IF OLD.hourly_rate IS DISTINCT FROM NEW.hourly_rate THEN
      INSERT INTO time_log_edit_history (
        time_log_id,
        tenant_id,
        edited_by,
        field_changed,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        v_tenant_id,
        v_user_id,
        'hourly_rate',
        OLD.hourly_rate::text,
        NEW.hourly_rate::text
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to log edits
DROP TRIGGER IF EXISTS trigger_log_time_log_edit ON time_logs;
CREATE TRIGGER trigger_log_time_log_edit
  BEFORE UPDATE ON time_logs
  FOR EACH ROW
  EXECUTE FUNCTION log_time_log_edit();

-- Create index for faster history queries
CREATE INDEX IF NOT EXISTS idx_time_log_edit_history_time_log_id 
  ON time_log_edit_history(time_log_id);

CREATE INDEX IF NOT EXISTS idx_time_log_edit_history_tenant_id 
  ON time_log_edit_history(tenant_id);

-- Add comment
COMMENT ON TABLE time_log_edit_history IS 'Audit trail for all time log edits to ensure data integrity and transparency';
COMMENT ON COLUMN time_logs.edit_count IS 'Number of times this time log has been manually edited';
COMMENT ON COLUMN time_logs.edited_at IS 'Timestamp of last manual edit';
COMMENT ON COLUMN time_logs.edited_by IS 'User who last edited this time log';