-- Add gst_registered field to vendors table
ALTER TABLE public.vendors 
ADD COLUMN gst_registered BOOLEAN DEFAULT false;

-- Add is_gst_free field to purchase_order_line_items
ALTER TABLE public.purchase_order_line_items 
ADD COLUMN is_gst_free BOOLEAN DEFAULT false;

-- Add is_gst_free field to quote_line_items
ALTER TABLE public.quote_line_items 
ADD COLUMN is_gst_free BOOLEAN DEFAULT false;

-- Add is_gst_free field to invoice_line_items
ALTER TABLE public.invoice_line_items 
ADD COLUMN is_gst_free BOOLEAN DEFAULT false;

-- Add is_gst_free field to project_line_items (if exists)
ALTER TABLE public.project_line_items 
ADD COLUMN is_gst_free BOOLEAN DEFAULT false;

-- Add is_gst_free field to service_order_line_items (if exists)
ALTER TABLE public.service_order_line_items 
ADD COLUMN is_gst_free BOOLEAN DEFAULT false;

-- Add is_gst_free field to change_order_line_items
ALTER TABLE public.change_order_line_items 
ADD COLUMN is_gst_free BOOLEAN DEFAULT false;

-- Create index for GST registered vendors
CREATE INDEX idx_vendors_gst_registered ON public.vendors(gst_registered) WHERE gst_registered = true;

-- Add comment explaining GST compliance
COMMENT ON COLUMN public.vendors.gst_registered IS 'Whether the vendor is registered for GST. Vendors who are not GST registered cannot legally charge GST.';
COMMENT ON COLUMN public.purchase_order_line_items.is_gst_free IS 'If true, this line item is GST-free and GST should not be calculated on it.';
COMMENT ON COLUMN public.quote_line_items.is_gst_free IS 'If true, this line item is GST-free and GST should not be calculated on it.';
COMMENT ON COLUMN public.invoice_line_items.is_gst_free IS 'If true, this line item is GST-free and GST should not be calculated on it.';