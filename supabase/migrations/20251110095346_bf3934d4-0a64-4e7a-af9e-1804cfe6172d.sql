-- Add new fields to task_templates table
ALTER TABLE task_templates 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS default_assigned_to UUID REFERENCES profiles(id);