-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  abn TEXT,
  legal_company_name TEXT,
  trading_name TEXT,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  vendor_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  notes TEXT,
  internal_notes TEXT,
  project_id UUID,
  service_order_id UUID,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create purchase_order_line_items table
CREATE TABLE public.purchase_order_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  po_id UUID NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  item_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_from_price_book BOOLEAN DEFAULT false,
  price_book_item_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create po_receipts table for tracking goods received
CREATE TABLE public.po_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  po_id UUID NOT NULL,
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create po_receipt_line_items table
CREATE TABLE public.po_receipt_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  receipt_id UUID NOT NULL,
  po_line_item_id UUID NOT NULL,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_receipt_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendors
CREATE POLICY "Users can view vendors in their tenant"
  ON public.vendors FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create vendors in their tenant"
  ON public.vendors FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update vendors in their tenant"
  ON public.vendors FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete vendors in their tenant"
  ON public.vendors FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- RLS policies for purchase_orders
CREATE POLICY "Users can view purchase orders in their tenant"
  ON public.purchase_orders FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create purchase orders in their tenant"
  ON public.purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update purchase orders in their tenant"
  ON public.purchase_orders FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete draft purchase orders in their tenant"
  ON public.purchase_orders FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND status = 'draft');

-- RLS policies for purchase_order_line_items
CREATE POLICY "Users can view PO line items in their tenant"
  ON public.purchase_order_line_items FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create PO line items in their tenant"
  ON public.purchase_order_line_items FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update PO line items in their tenant"
  ON public.purchase_order_line_items FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete PO line items in their tenant"
  ON public.purchase_order_line_items FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- RLS policies for po_receipts
CREATE POLICY "Users can view receipts in their tenant"
  ON public.po_receipts FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create receipts in their tenant"
  ON public.po_receipts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update receipts in their tenant"
  ON public.po_receipts FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete receipts in their tenant"
  ON public.po_receipts FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- RLS policies for po_receipt_line_items
CREATE POLICY "Users can view receipt line items in their tenant"
  ON public.po_receipt_line_items FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create receipt line items in their tenant"
  ON public.po_receipt_line_items FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update receipt line items in their tenant"
  ON public.po_receipt_line_items FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete receipt line items in their tenant"
  ON public.po_receipt_line_items FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Create indexes for performance
CREATE INDEX idx_vendors_tenant ON public.vendors(tenant_id);
CREATE INDEX idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_vendor ON public.purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_project ON public.purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_service_order ON public.purchase_orders(service_order_id);
CREATE INDEX idx_po_line_items_po ON public.purchase_order_line_items(po_id);
CREATE INDEX idx_po_receipts_po ON public.po_receipts(po_id);
CREATE INDEX idx_po_receipt_line_items_receipt ON public.po_receipt_line_items(receipt_id);

-- Create triggers for updated_at
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_line_items_updated_at
  BEFORE UPDATE ON public.purchase_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_po_receipts_updated_at
  BEFORE UPDATE ON public.po_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit log triggers
CREATE TRIGGER audit_vendors
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_po_receipts
  AFTER INSERT OR UPDATE OR DELETE ON public.po_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();