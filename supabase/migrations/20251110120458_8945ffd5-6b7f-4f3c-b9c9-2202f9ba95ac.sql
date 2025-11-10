-- Add support for paused time logs
-- No schema changes needed - we'll use multiple time_log entries for pause/resume cycles

-- Create function to auto clock-out from other appointments
CREATE OR REPLACE FUNCTION auto_clock_out_other_appointments(
  p_worker_id UUID,
  p_new_appointment_id UUID,
  p_tenant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clock out all active time logs for this worker except the new appointment
  UPDATE time_logs
  SET clock_out = NOW(),
      notes = COALESCE(notes, '') || E'\n[Auto clocked-out due to clocking into another appointment]'
  WHERE worker_id = p_worker_id
    AND tenant_id = p_tenant_id
    AND clock_out IS NULL
    AND appointment_id != p_new_appointment_id;
END;
$$;

-- Create function to cleanup overlapping time logs (runs daily at 4am)
CREATE OR REPLACE FUNCTION cleanup_overlapping_time_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overlap_record RECORD;
BEGIN
  -- Find overlapping time logs for the same worker
  FOR overlap_record IN
    SELECT 
      t1.id as log1_id,
      t2.id as log2_id,
      t1.worker_id,
      t1.appointment_id as apt1_id,
      t2.appointment_id as apt2_id,
      t1.clock_in as t1_start,
      t1.clock_out as t1_end,
      t2.clock_in as t2_start,
      t2.clock_out as t2_end
    FROM time_logs t1
    INNER JOIN time_logs t2 ON 
      t1.worker_id = t2.worker_id 
      AND t1.tenant_id = t2.tenant_id
      AND t1.id < t2.id  -- Avoid duplicate pairs
      AND t1.appointment_id != t2.appointment_id  -- Different appointments
    WHERE 
      -- Check for overlap: t1 starts before t2 ends AND t2 starts before t1 ends
      t1.clock_in < COALESCE(t2.clock_out, NOW())
      AND t2.clock_in < COALESCE(t1.clock_out, NOW())
      -- Only check logs from last 7 days
      AND t1.clock_in > NOW() - INTERVAL '7 days'
  LOOP
    -- Log the overlap to audit_logs
    INSERT INTO audit_logs (
      tenant_id,
      user_id,
      user_name,
      table_name,
      record_id,
      action,
      field_name,
      old_value,
      new_value,
      note
    )
    SELECT 
      t.tenant_id,
      t.worker_id,
      'System Cleanup',
      'time_logs',
      overlap_record.log2_id,
      'update',
      'clock_out',
      t.clock_out::text,
      overlap_record.t2_start::text,
      'Auto-resolved overlapping time log. Original end time: ' || COALESCE(t.clock_out::text, 'still active')
    FROM time_logs t
    WHERE t.id = overlap_record.log2_id;
    
    -- Clock out the later log at the start time of the earlier one
    UPDATE time_logs
    SET 
      clock_out = overlap_record.t2_start,
      notes = COALESCE(notes, '') || E'\n[System: Auto-resolved overlap at ' || NOW()::text || ']'
    WHERE id = overlap_record.log2_id
      AND clock_out IS NULL;  -- Only if still active
      
  END LOOP;
  
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;