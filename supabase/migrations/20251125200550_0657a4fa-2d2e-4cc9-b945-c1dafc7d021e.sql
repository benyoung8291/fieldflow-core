-- Add performance indexes for commonly queried and sorted fields

-- Service Orders indexes
CREATE INDEX IF NOT EXISTS idx_service_orders_order_number ON public.service_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON public.service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_customer_id ON public.service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_preferred_date ON public.service_orders(preferred_date);
CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON public.service_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_tenant_status ON public.service_orders(tenant_id, status);

-- Appointments indexes
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON public.appointments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_appointments_service_order_id ON public.appointments(service_order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON public.appointments(tenant_id, status);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON public.quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_status ON public.quotes(tenant_id, status);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON public.customers(is_active);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);

-- Time logs indexes (uses appointment_id, not service_order_id)
CREATE INDEX IF NOT EXISTS idx_time_logs_worker_id ON public.time_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_appointment_id ON public.time_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_clock_in ON public.time_logs(clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_time_logs_tenant_worker ON public.time_logs(tenant_id, worker_id);

-- Purchase orders indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON public.purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);

-- Service contracts indexes
CREATE INDEX IF NOT EXISTS idx_service_contracts_status ON public.service_contracts(status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_customer_id ON public.service_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_created_at ON public.service_contracts(created_at DESC);

-- Helpdesk tickets indexes
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON public.helpdesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_priority ON public.helpdesk_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_assigned_to ON public.helpdesk_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_created_at ON public.helpdesk_tickets(created_at DESC);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON public.contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(status);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);