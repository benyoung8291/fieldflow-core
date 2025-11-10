-- Add created_by column to project_tasks table
ALTER TABLE public.project_tasks 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);