-- Create storage bucket for service order attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-order-attachments', 'service-order-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create service_order_attachments table
CREATE TABLE IF NOT EXISTS public.service_order_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  is_internal BOOLEAN DEFAULT true,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_order_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for attachments
CREATE POLICY "Users can view attachments in their tenant"
  ON public.service_order_attachments
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create attachments in their tenant"
  ON public.service_order_attachments
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete attachments in their tenant"
  ON public.service_order_attachments
  FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Storage policies for service order attachments bucket
CREATE POLICY "Users can view their tenant attachments"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'service-order-attachments' AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tenant_id = (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can upload their tenant attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'service-order-attachments' AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tenant_id = (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their tenant attachments"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'service-order-attachments' AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tenant_id = (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Add audit trigger for service_orders table (if not exists)
DROP TRIGGER IF EXISTS service_orders_audit_trigger ON public.service_orders;
CREATE TRIGGER service_orders_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- Add updated_at trigger for service_orders (if not exists)
DROP TRIGGER IF EXISTS service_orders_updated_at_trigger ON public.service_orders;
CREATE TRIGGER service_orders_updated_at_trigger
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();