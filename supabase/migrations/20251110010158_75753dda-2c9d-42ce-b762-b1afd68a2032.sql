-- Add project management fields to tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS estimated_hours numeric,
ADD COLUMN IF NOT EXISTS actual_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- Create task_dependencies table for managing task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start', -- finish_to_start, start_to_start, finish_to_finish, start_to_finish
  lag_days integer DEFAULT 0, -- positive for delay, negative for lead time
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id) -- prevent self-dependency
);

-- Enable RLS on task_dependencies
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_dependencies
CREATE POLICY "Users can view task dependencies in their tenant"
ON task_dependencies FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can manage task dependencies in their tenant"
ON task_dependencies FOR ALL
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- Create function to calculate task end date based on dependencies
CREATE OR REPLACE FUNCTION calculate_task_dates()
RETURNS TRIGGER AS $$
DECLARE
  max_dependency_end_date date;
  calculated_start_date date;
BEGIN
  -- If start_date is explicitly set, use it
  IF NEW.start_date IS NOT NULL THEN
    -- Calculate end_date if estimated_hours is set and end_date is not
    IF NEW.estimated_hours IS NOT NULL AND NEW.end_date IS NULL THEN
      -- Assume 8 hour work days
      NEW.end_date := NEW.start_date + CEIL(NEW.estimated_hours / 8.0)::integer;
    END IF;
    RETURN NEW;
  END IF;

  -- Check for dependencies
  SELECT MAX(
    CASE td.dependency_type
      WHEN 'finish_to_start' THEN t.end_date + td.lag_days
      WHEN 'start_to_start' THEN t.start_date + td.lag_days
      WHEN 'finish_to_finish' THEN t.end_date + td.lag_days - CEIL(NEW.estimated_hours / 8.0)::integer
      WHEN 'start_to_finish' THEN t.start_date + td.lag_days - CEIL(NEW.estimated_hours / 8.0)::integer
      ELSE t.end_date + td.lag_days
    END
  )
  INTO max_dependency_end_date
  FROM task_dependencies td
  JOIN tasks t ON t.id = td.depends_on_task_id
  WHERE td.task_id = NEW.id AND t.end_date IS NOT NULL;

  -- Set calculated start date based on dependencies
  IF max_dependency_end_date IS NOT NULL THEN
    NEW.start_date := max_dependency_end_date;
  END IF;

  -- Calculate end_date if estimated_hours is set
  IF NEW.estimated_hours IS NOT NULL AND NEW.start_date IS NOT NULL AND NEW.end_date IS NULL THEN
    NEW.end_date := NEW.start_date + CEIL(NEW.estimated_hours / 8.0)::integer;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate task dates
CREATE TRIGGER calculate_task_dates_trigger
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION calculate_task_dates();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_linked_record ON tasks(linked_module, linked_record_id);