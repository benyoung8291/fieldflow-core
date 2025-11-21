-- Create ap_invoices table for AP Bills
CREATE TABLE IF NOT EXISTS ap_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  supplier_invoice_number text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  
  -- Acumatica sync fields
  acumatica_invoice_id text,
  acumatica_reference_nbr text,
  acumatica_status text,
  sync_status text,
  sync_error text,
  last_synced_at timestamptz,
  synced_to_accounting_at timestamptz,
  
  -- Approval fields
  requires_manager_approval boolean DEFAULT false,
  approval_requested_at timestamptz,
  approval_requested_by uuid REFERENCES profiles(id),
  manager_approved_by uuid REFERENCES profiles(id),
  manager_approved_at timestamptz,
  manager_approval_notes text,
  approval_status text,
  
  -- Audit fields
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT ap_invoices_tenant_invoice_number_unique UNIQUE (tenant_id, invoice_number)
);

-- Create ap_invoice_line_items table
CREATE TABLE IF NOT EXISTS ap_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ap_invoice_id uuid NOT NULL REFERENCES ap_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  account_code text,
  sub_account text,
  item_order integer NOT NULL DEFAULT 0,
  is_gst_free boolean DEFAULT false,
  
  -- Source tracking
  source_type text,
  source_id uuid,
  line_item_id uuid,
  
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ap_invoices_tenant_id ON ap_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_supplier_id ON ap_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_status ON ap_invoices(status);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_acumatica_ref ON ap_invoices(acumatica_reference_nbr);
CREATE INDEX IF NOT EXISTS idx_ap_invoice_line_items_ap_invoice_id ON ap_invoice_line_items(ap_invoice_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoice_line_items_tenant_id ON ap_invoice_line_items(tenant_id);

-- Enable RLS
ALTER TABLE ap_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ap_invoices
CREATE POLICY "Users can view AP invoices in their tenant"
  ON ap_invoices FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create AP invoices in their tenant"
  ON ap_invoices FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update AP invoices in their tenant"
  ON ap_invoices FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete AP invoices in their tenant"
  ON ap_invoices FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for ap_invoice_line_items
CREATE POLICY "Users can view AP invoice line items in their tenant"
  ON ap_invoice_line_items FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create AP invoice line items in their tenant"
  ON ap_invoice_line_items FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update AP invoice line items in their tenant"
  ON ap_invoice_line_items FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete AP invoice line items in their tenant"
  ON ap_invoice_line_items FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Migrate existing AP invoices from invoices table to ap_invoices
INSERT INTO ap_invoices (
  id,
  tenant_id,
  supplier_id,
  invoice_number,
  supplier_invoice_number,
  invoice_date,
  due_date,
  subtotal,
  tax_amount,
  total_amount,
  status,
  notes,
  acumatica_invoice_id,
  acumatica_reference_nbr,
  acumatica_status,
  sync_status,
  sync_error,
  last_synced_at,
  synced_to_accounting_at,
  requires_manager_approval,
  approval_requested_at,
  approval_requested_by,
  manager_approved_by,
  manager_approved_at,
  manager_approval_notes,
  approval_status,
  created_by,
  created_at,
  updated_at
)
SELECT 
  id,
  tenant_id,
  supplier_id,
  invoice_number,
  supplier_invoice_number,
  invoice_date,
  due_date,
  subtotal,
  tax_amount,
  total_amount,
  status,
  notes,
  acumatica_invoice_id,
  acumatica_reference_nbr,
  acumatica_status,
  sync_status,
  sync_error,
  last_synced_at,
  synced_to_accounting_at,
  requires_manager_approval,
  approval_requested_at,
  approval_requested_by,
  manager_approved_by,
  manager_approved_at,
  manager_approval_notes,
  approval_status,
  created_by,
  created_at,
  updated_at
FROM invoices
WHERE invoice_type = 'ap';

-- Migrate AP invoice line items
INSERT INTO ap_invoice_line_items (
  id,
  tenant_id,
  ap_invoice_id,
  description,
  quantity,
  unit_price,
  line_total,
  account_code,
  sub_account,
  item_order,
  is_gst_free,
  source_type,
  source_id,
  line_item_id,
  created_at
)
SELECT 
  ili.id,
  ili.tenant_id,
  ili.invoice_id,
  ili.description,
  ili.quantity,
  ili.unit_price,
  ili.line_total,
  ili.account_code,
  ili.sub_account,
  ili.item_order,
  ili.is_gst_free,
  ili.source_type,
  ili.source_id,
  ili.line_item_id,
  ili.created_at
FROM invoice_line_items ili
INNER JOIN invoices i ON ili.invoice_id = i.id
WHERE i.invoice_type = 'ap';

-- Update integration_sync_logs to reference ap_invoices
ALTER TABLE integration_sync_logs 
ADD COLUMN IF NOT EXISTS ap_invoice_id uuid REFERENCES ap_invoices(id) ON DELETE CASCADE;

-- Migrate sync logs for AP invoices
UPDATE integration_sync_logs
SET ap_invoice_id = invoice_id
WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_type = 'ap');

-- Delete AP invoice line items from invoice_line_items
DELETE FROM invoice_line_items
WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_type = 'ap');

-- Delete AP invoices from invoices table
DELETE FROM invoices WHERE invoice_type = 'ap';

-- Remove invoice_type column from invoices table (now only AR)
ALTER TABLE invoices DROP COLUMN IF EXISTS invoice_type;

-- Remove AP-specific columns from invoices table
ALTER TABLE invoices DROP COLUMN IF EXISTS supplier_id;
ALTER TABLE invoices DROP COLUMN IF EXISTS supplier_invoice_number;

-- Add comment to document table purposes
COMMENT ON TABLE invoices IS 'AR Invoices (customer invoices) - AP invoices are in ap_invoices table';
COMMENT ON TABLE ap_invoices IS 'AP Invoices (supplier bills)';
