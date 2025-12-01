-- Insert default permissions for new modules with only standard permissions
DO $$
DECLARE
  v_tenant_id uuid;
  v_module app_module;
  v_role user_role;
  v_permission permission_type;
BEGIN
  FOR v_tenant_id IN SELECT DISTINCT tenant_id FROM role_permissions
  LOOP
    FOREACH v_module IN ARRAY ARRAY['helpdesk', 'purchase_orders', 'suppliers', 'timesheets', 
                                     'tasks', 'field_reports', 'contacts', 'ap_invoices', 
                                     'workflows', 'knowledge_base', 'reports']::app_module[]
    LOOP
      FOREACH v_role IN ARRAY ARRAY['supervisor', 'worker', 'accountant', 'warehouse_manager', 'subcontractor']::user_role[]
      LOOP
        FOREACH v_permission IN ARRAY ARRAY['view', 'create', 'edit', 'delete']::permission_type[]
        LOOP
          INSERT INTO role_permissions (tenant_id, role, module, permission, is_active)
          VALUES (v_tenant_id, v_role, v_module, v_permission, true)
          ON CONFLICT (tenant_id, role, module, permission) DO NOTHING;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;