-- Add tags array column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add index for better tag filtering performance
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);