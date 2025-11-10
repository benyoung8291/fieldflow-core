-- Fix SECURITY DEFINER functions missing search_path
CREATE OR REPLACE FUNCTION public.update_project_budget_from_change_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Update project's total change orders and revised budget
  UPDATE public.projects
  SET 
    total_change_orders = (
      SELECT COALESCE(SUM(budget_impact), 0)
      FROM public.project_change_orders
      WHERE project_id = NEW.project_id AND status = 'approved'
    ),
    revised_budget = original_budget + (
      SELECT COALESCE(SUM(budget_impact), 0)
      FROM public.project_change_orders
      WHERE project_id = NEW.project_id AND status = 'approved'
    )
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_next_sequential_number(p_tenant_id UUID, p_entity_type TEXT)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Secure company-logos storage bucket
UPDATE storage.buckets 
SET public = false 
WHERE id = 'company-logos';

-- Drop old permissive policy
DROP POLICY IF EXISTS "Authenticated users can view company logos" ON storage.objects;

-- Create tenant-isolated SELECT policy for company logos
CREATE POLICY "Users can view their tenant's company logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);