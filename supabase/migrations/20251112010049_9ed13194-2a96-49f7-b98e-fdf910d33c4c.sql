-- Add DELETE policy for brand_colors so we can manage colors properly
DROP POLICY IF EXISTS "Users can delete their tenant's brand colors" ON public.brand_colors;

CREATE POLICY "Users can delete their tenant's brand colors"
ON public.brand_colors
FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
));

-- Create a function to initialize default brand colors for a tenant
CREATE OR REPLACE FUNCTION public.initialize_brand_colors(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete any existing colors for this tenant
  DELETE FROM brand_colors WHERE tenant_id = p_tenant_id;
  
  -- Insert default Premrest color palette
  INSERT INTO brand_colors (tenant_id, color_key, color_value, color_group, display_order) VALUES
  -- Primary colors
  (p_tenant_id, 'primary-1', '#2e3133', 'primary', 0),
  (p_tenant_id, 'primary-2', '#d1703c', 'primary', 1),
  (p_tenant_id, 'primary-3', '#f9cb8f', 'primary', 2),
  
  -- Secondary colors
  (p_tenant_id, 'secondary-1', '#aac9db', 'secondary', 0),
  (p_tenant_id, 'secondary-2', '#aeba6c', 'secondary', 1),
  (p_tenant_id, 'secondary-3', '#e2e2e6', 'secondary', 2),
  (p_tenant_id, 'secondary-4', '#604d45', 'secondary', 3),
  (p_tenant_id, 'secondary-5', '#aa7533', 'secondary', 4),
  
  -- System colors (these map to CSS variables)
  (p_tenant_id, 'primary', '#d1703c', 'system', 0),
  (p_tenant_id, 'secondary', '#aeba6c', 'system', 1),
  (p_tenant_id, 'accent', '#f9cb8f', 'system', 2),
  (p_tenant_id, 'success', '#16a34a', 'system', 3),
  (p_tenant_id, 'warning', '#f59e0b', 'system', 4),
  (p_tenant_id, 'error', '#dc2626', 'system', 5),
  (p_tenant_id, 'info', '#0ea5e9', 'system', 6);
END;
$$;