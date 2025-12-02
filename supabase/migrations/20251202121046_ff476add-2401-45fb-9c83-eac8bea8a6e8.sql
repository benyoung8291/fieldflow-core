-- Add template_image_url column to pdf_templates table for high-resolution PDF backgrounds
ALTER TABLE pdf_templates 
ADD COLUMN IF NOT EXISTS template_image_url TEXT;

COMMENT ON COLUMN pdf_templates.template_image_url IS 'High-resolution base64 PNG image of the template for PDF background (multiplier: 3)';