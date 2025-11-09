-- Create audit log table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'revert')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view audit logs in their tenant"
  ON public.audit_logs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Create indexes for performance
CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Function to automatically log changes
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
  v_tenant_id UUID;
  v_old_json JSONB;
  v_new_json JSONB;
  v_key TEXT;
BEGIN
  -- Get user name
  SELECT COALESCE(
    (SELECT first_name || ' ' || COALESCE(last_name, '') FROM public.profiles WHERE id = auth.uid()),
    auth.email()
  ) INTO v_user_name;
  
  -- Get tenant_id
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() INTO v_tenant_id;
  
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- For INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      tenant_id, user_id, user_name, table_name, record_id, action, new_value
    ) VALUES (
      v_tenant_id, auth.uid(), v_user_name, TG_TABLE_NAME, NEW.id, 'create', to_jsonb(NEW)::text
    );
    RETURN NEW;
  END IF;

  -- For UPDATE
  IF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
    
    -- Loop through all keys and log changes
    FOR v_key IN SELECT jsonb_object_keys(v_new_json)
    LOOP
      -- Skip system fields
      IF v_key NOT IN ('updated_at', 'created_at') AND 
         v_old_json->v_key IS DISTINCT FROM v_new_json->v_key THEN
        INSERT INTO public.audit_logs (
          tenant_id, user_id, user_name, table_name, record_id, action, field_name, old_value, new_value
        ) VALUES (
          v_tenant_id, auth.uid(), v_user_name, TG_TABLE_NAME, NEW.id, 'update', 
          v_key, v_old_json->>v_key, v_new_json->>v_key
        );
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- For DELETE
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      tenant_id, user_id, user_name, table_name, record_id, action, old_value
    ) VALUES (
      v_tenant_id, auth.uid(), v_user_name, TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD)::text
    );
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- Add audit triggers to key tables
CREATE TRIGGER audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_service_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_customer_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();