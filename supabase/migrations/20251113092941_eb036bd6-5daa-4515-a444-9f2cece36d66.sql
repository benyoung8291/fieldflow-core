-- Add task view preferences to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS task_view_preference TEXT DEFAULT 'list' CHECK (task_view_preference IN ('list', 'kanban')),
ADD COLUMN IF NOT EXISTS task_kanban_mode TEXT DEFAULT 'business_days' CHECK (task_kanban_mode IN ('business_days', 'consecutive_days', 'include_weekends'));