-- Add performance indexes on frequently queried columns
-- Only adding indexes for verified columns to avoid errors

-- Tasks table indexes
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assigned_status ON tasks(tenant_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_created ON tasks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due_date ON tasks(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_linked_record ON tasks(linked_module, linked_record_id);

-- Appointments table indexes
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_assigned ON appointments(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_start ON appointments(tenant_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_service_order ON appointments(service_order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON appointments(tenant_id, status);

-- Service Orders table indexes
CREATE INDEX IF NOT EXISTS idx_service_orders_tenant_customer ON service_orders(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_tenant_status ON service_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_service_orders_tenant_created ON service_orders(tenant_id, created_at DESC);

-- Quotes table indexes
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_customer ON quotes(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_lead ON quotes(tenant_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_status ON quotes(tenant_id, status);

-- Purchase Orders table indexes  
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_supplier ON purchase_orders(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_status ON purchase_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_service_order ON purchase_orders(service_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON purchase_orders(project_id);

-- Contacts table indexes
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_customer ON contacts(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email ON contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_status ON contacts(tenant_id, status);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_tenant_active ON customers(tenant_id, is_active);

-- Suppliers table indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_tenant_customer ON projects(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_created ON projects(tenant_id, created_at DESC);

-- AP Invoices table indexes
CREATE INDEX IF NOT EXISTS idx_ap_invoices_tenant_supplier ON ap_invoices(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_tenant_status ON ap_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_service_order ON ap_invoices(service_order_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_project ON ap_invoices(project_id);

-- Audit Logs table index
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_table_record ON audit_logs(tenant_id, table_name, record_id, created_at DESC);