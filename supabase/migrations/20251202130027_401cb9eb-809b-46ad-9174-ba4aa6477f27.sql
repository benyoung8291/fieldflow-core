-- Add new columns to pdf_templates for unified template system
ALTER TABLE pdf_templates ADD COLUMN IF NOT EXISTS field_mappings jsonb DEFAULT '{}';
ALTER TABLE pdf_templates ADD COLUMN IF NOT EXISTS line_items_config jsonb DEFAULT '{
  "columns": ["description", "quantity", "unit_price", "line_total"],
  "show_sub_items": true,
  "column_widths": {"description": 50, "quantity": 12, "unit_price": 19, "line_total": 19},
  "header_style": {"background": "#f3f4f6", "font_weight": "bold"},
  "row_style": {"border_bottom": true}
}';
ALTER TABLE pdf_templates ADD COLUMN IF NOT EXISTS header_config jsonb;
ALTER TABLE pdf_templates ADD COLUMN IF NOT EXISTS footer_config jsonb;
ALTER TABLE pdf_templates ADD COLUMN IF NOT EXISTS content_zones jsonb DEFAULT '{
  "header": {"y": 0, "height": 120},
  "document_info": {"y": 120, "height": 100},
  "line_items": {"y": 220, "height": "auto"},
  "totals": {"y": "after_line_items", "height": 80},
  "footer": {"y": "bottom", "height": 100}
}';
ALTER TABLE pdf_templates ADD COLUMN IF NOT EXISTS page_settings jsonb DEFAULT '{
  "size": "A4",
  "orientation": "portrait",
  "margins": {"top": 40, "right": 40, "bottom": 40, "left": 40}
}';