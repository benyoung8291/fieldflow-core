-- Create table for brand color settings
CREATE TABLE IF NOT EXISTS public.brand_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  color_key TEXT NOT NULL,
  color_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, color_key)
);

-- Enable RLS
ALTER TABLE public.brand_colors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their tenant's brand colors"
ON public.brand_colors
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert their tenant's brand colors"
ON public.brand_colors
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their tenant's brand colors"
ON public.brand_colors
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_brand_colors_updated_at
BEFORE UPDATE ON public.brand_colors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();