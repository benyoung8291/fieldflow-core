-- Add missing permission enum values (approve, export, import)
ALTER TYPE permission_type ADD VALUE IF NOT EXISTS 'approve';
ALTER TYPE permission_type ADD VALUE IF NOT EXISTS 'export';
ALTER TYPE permission_type ADD VALUE IF NOT EXISTS 'import';