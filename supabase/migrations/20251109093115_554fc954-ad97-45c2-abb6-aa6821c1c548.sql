-- Add color column to menu_items table
ALTER TABLE menu_items 
ADD COLUMN color text;

-- Set default colors for existing menu items
UPDATE menu_items SET color = '#3b82f6' WHERE label = 'Dashboard';
UPDATE menu_items SET color = '#8b5cf6' WHERE label = 'Tasks';
UPDATE menu_items SET color = '#10b981' WHERE label = 'CRM';
UPDATE menu_items SET color = '#f59e0b' WHERE label = 'Service';
UPDATE menu_items SET color = '#3b82f6' WHERE label = 'Projects';
UPDATE menu_items SET color = '#ec4899' WHERE label = 'Analytics';
UPDATE menu_items SET color = '#6366f1' WHERE label = 'Settings';