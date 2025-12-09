-- Seed default permissions for management role (full access to all modules)
-- This creates a proper audit trail instead of relying on code bypass
DO $$
DECLARE
  v_tenant_id uuid;
  v_module app_module;
  v_permission permission_type;
BEGIN
  -- Loop through all existing tenants that have role_permissions
  FOR v_tenant_id IN SELECT DISTINCT tenant_id FROM role_permissions
  LOOP
    -- Loop through all modules for management role
    FOREACH v_module IN ARRAY ARRAY[
      'customers', 'leads', 'quotes', 'projects', 'service_orders', 
      'appointments', 'workers', 'service_contracts', 'analytics', 
      'settings', 'price_book', 'helpdesk', 'purchase_orders', 
      'suppliers', 'timesheets', 'tasks', 'field_reports', 'contacts', 
      'ap_invoices', 'workflows', 'knowledge_base', 'reports', 
      'expenses', 'invoices', 'user_management', 'integrations',
      'recurring_invoices'
    ]::app_module[]
    LOOP
      -- Grant all permission types to management
      FOREACH v_permission IN ARRAY ARRAY['view', 'create', 'edit', 'delete', 'approve', 'export', 'import']::permission_type[]
      LOOP
        INSERT INTO role_permissions (tenant_id, role, module, permission, is_active)
        VALUES (v_tenant_id, 'management', v_module, v_permission, true)
        ON CONFLICT (tenant_id, role, module, permission) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Ensure tenant_admin has all permissions including approve, export, import
-- (these were previously missing for some modules)
DO $$
DECLARE
  v_tenant_id uuid;
  v_module app_module;
  v_permission permission_type;
BEGIN
  FOR v_tenant_id IN SELECT DISTINCT tenant_id FROM role_permissions
  LOOP
    FOREACH v_module IN ARRAY ARRAY[
      'customers', 'leads', 'quotes', 'projects', 'service_orders', 
      'appointments', 'workers', 'service_contracts', 'analytics', 
      'settings', 'price_book', 'helpdesk', 'purchase_orders', 
      'suppliers', 'timesheets', 'tasks', 'field_reports', 'contacts', 
      'ap_invoices', 'workflows', 'knowledge_base', 'reports', 
      'expenses', 'invoices', 'user_management', 'integrations',
      'recurring_invoices'
    ]::app_module[]
    LOOP
      -- Grant all permission types to tenant_admin
      FOREACH v_permission IN ARRAY ARRAY['view', 'create', 'edit', 'delete', 'approve', 'export', 'import']::permission_type[]
      LOOP
        INSERT INTO role_permissions (tenant_id, role, module, permission, is_active)
        VALUES (v_tenant_id, 'tenant_admin', v_module, v_permission, true)
        ON CONFLICT (tenant_id, role, module, permission) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;