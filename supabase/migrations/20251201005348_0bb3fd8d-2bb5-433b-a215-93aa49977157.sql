-- Add new module types to the app_module enum
-- These will be committed before use in subsequent operations
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'helpdesk';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'purchase_orders';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'suppliers';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'timesheets';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'tasks';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'field_reports';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'contacts';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'ap_invoices';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'workflows';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'knowledge_base';
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'reports';