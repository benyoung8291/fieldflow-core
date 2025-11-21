-- Add show_description_on_card field to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS show_description_on_card BOOLEAN DEFAULT false;