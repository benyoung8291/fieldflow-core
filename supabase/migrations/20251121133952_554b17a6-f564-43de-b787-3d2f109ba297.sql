-- Add purchase_receipt_id to ap_invoices for linking AP invoices to purchase receipts
ALTER TABLE public.ap_invoices
ADD COLUMN IF NOT EXISTS purchase_receipt_id UUID REFERENCES public.po_receipts(id) ON DELETE SET NULL;

-- Add service_order_id to ap_invoices if not exists (for direct linking to service orders)
ALTER TABLE public.ap_invoices
ADD COLUMN IF NOT EXISTS service_order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL;

-- Add project_id to ap_invoices if not exists (for direct linking to projects)
ALTER TABLE public.ap_invoices
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ap_invoices_purchase_receipt_id ON public.ap_invoices(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_service_order_id ON public.ap_invoices(service_order_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_project_id ON public.ap_invoices(project_id);