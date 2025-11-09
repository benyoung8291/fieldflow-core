-- Create table for sequential number settings
CREATE TABLE IF NOT EXISTS public.sequential_number_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('service_order', 'quote', 'invoice')),
  prefix TEXT NOT NULL DEFAULT '',
  next_number INTEGER NOT NULL DEFAULT 1,
  number_length INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, entity_type)
);

-- Enable RLS
ALTER TABLE public.sequential_number_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view sequential settings in their tenant"
  ON public.sequential_number_settings
  FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage sequential settings"
  ON public.sequential_number_settings
  FOR ALL
  USING (
    tenant_id = get_user_tenant_id() AND 
    has_role(auth.uid(), 'tenant_admin'::user_role)
  );

-- Create function to get next number
CREATE OR REPLACE FUNCTION get_next_sequential_number(
  p_tenant_id UUID,
  p_entity_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_settings RECORD;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Get or create settings for this entity type
  INSERT INTO sequential_number_settings (tenant_id, entity_type, next_number)
  VALUES (p_tenant_id, p_entity_type, 1)
  ON CONFLICT (tenant_id, entity_type) DO NOTHING;
  
  -- Lock the row and get current settings
  SELECT * INTO v_settings
  FROM sequential_number_settings
  WHERE tenant_id = p_tenant_id AND entity_type = p_entity_type
  FOR UPDATE;
  
  -- Get the next number
  v_next_number := v_settings.next_number;
  
  -- Format the number with padding
  v_formatted_number := v_settings.prefix || LPAD(v_next_number::TEXT, v_settings.number_length, '0');
  
  -- Increment for next time
  UPDATE sequential_number_settings
  SET next_number = next_number + 1, updated_at = now()
  WHERE tenant_id = p_tenant_id AND entity_type = p_entity_type;
  
  RETURN v_formatted_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;