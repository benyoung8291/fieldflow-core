-- Add color_group field to brand_colors table
ALTER TABLE public.brand_colors 
ADD COLUMN IF NOT EXISTS color_group TEXT;

-- Add display_order for sorting colors within groups
ALTER TABLE public.brand_colors 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_brand_colors_group 
ON public.brand_colors(tenant_id, color_group, display_order);