-- Add parent_task_id for task hierarchy (subtasks)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_task_id);

-- Add depth level to limit nesting (optional, for UI clarity)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depth_level integer DEFAULT 0;

COMMENT ON COLUMN tasks.parent_task_id IS 'Reference to parent task for subtask hierarchy';
COMMENT ON COLUMN tasks.depth_level IS 'Nesting level: 0 = top-level task, 1 = subtask, 2 = sub-subtask (limit to 2 levels recommended)';