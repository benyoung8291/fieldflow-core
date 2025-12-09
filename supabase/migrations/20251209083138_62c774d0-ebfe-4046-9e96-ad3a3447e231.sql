-- Create data_access_logs table for tracking user data access
CREATE TABLE public.data_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('view', 'list', 'search', 'export', 'download')),
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Use BRIN index for time-series queries (very efficient for append-only logs)
CREATE INDEX idx_data_access_logs_accessed_at_brin ON public.data_access_logs USING BRIN (accessed_at);

-- Standard indexes for filtering
CREATE INDEX idx_data_access_logs_tenant_id ON public.data_access_logs (tenant_id);
CREATE INDEX idx_data_access_logs_user_id ON public.data_access_logs (user_id);
CREATE INDEX idx_data_access_logs_table_name ON public.data_access_logs (table_name);
CREATE INDEX idx_data_access_logs_record_id ON public.data_access_logs (record_id);

-- Enable RLS
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own access logs
CREATE POLICY "Users can insert own access logs"
ON public.data_access_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Tenant admins can view all logs in their tenant
CREATE POLICY "Tenant admins can view tenant logs"
ON public.data_access_logs
FOR SELECT
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'super_admin')
  )
);

-- Create batch insert function for efficiency
CREATE OR REPLACE FUNCTION public.batch_insert_access_logs(logs JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_log JSONB;
BEGIN
  FOR v_log IN SELECT * FROM jsonb_array_elements(logs)
  LOOP
    INSERT INTO data_access_logs (
      tenant_id,
      user_id,
      user_name,
      table_name,
      record_id,
      action,
      metadata,
      ip_address,
      user_agent,
      accessed_at
    ) VALUES (
      (v_log->>'tenant_id')::UUID,
      (v_log->>'user_id')::UUID,
      v_log->>'user_name',
      v_log->>'table_name',
      v_log->>'record_id',
      v_log->>'action',
      COALESCE(v_log->'metadata', '{}'),
      v_log->>'ip_address',
      v_log->>'user_agent',
      COALESCE((v_log->>'accessed_at')::TIMESTAMPTZ, now())
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;