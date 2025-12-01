-- Phase 1: Fix database enums - Add missing roles and modules

-- Add missing roles to app_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('tenant_admin', 'supervisor');
  END IF;
END $$;

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'management';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'worker';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'warehouse_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'subcontractor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'customer';

-- Add missing modules to app_module enum
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'expenses';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'invoices';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'user_management';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'integrations';