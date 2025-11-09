-- Fix search path for get_next_sequential_number function
CREATE OR REPLACE FUNCTION get_next_sequential_number(
  p_tenant_id UUID,
  p_entity_type TEXT
) RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings RECORD;
  v_next_number INTEGER;
  v_formatted_number TEXT;
BEGIN
  -- Get or create settings for this entity type
  INSERT INTO public.sequential_number_settings (tenant_id, entity_type, next_number)
  VALUES (p_tenant_id, p_entity_type, 1)
  ON CONFLICT (tenant_id, entity_type) DO NOTHING;
  
  -- Lock the row and get current settings
  SELECT * INTO v_settings
  FROM public.sequential_number_settings
  WHERE tenant_id = p_tenant_id AND entity_type = p_entity_type
  FOR UPDATE;
  
  -- Get the next number
  v_next_number := v_settings.next_number;
  
  -- Format the number with padding
  v_formatted_number := v_settings.prefix || LPAD(v_next_number::TEXT, v_settings.number_length, '0');
  
  -- Increment for next time
  UPDATE public.sequential_number_settings
  SET next_number = next_number + 1, updated_at = now()
  WHERE tenant_id = p_tenant_id AND entity_type = p_entity_type;
  
  RETURN v_formatted_number;
END;
$$;