-- Fix search path for the ensure_single_sticky_note function
CREATE OR REPLACE FUNCTION ensure_single_sticky_note()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_sticky = true THEN
    -- Unset all other sticky notes for this document
    UPDATE public.document_notes
    SET is_sticky = false
    WHERE document_type = NEW.document_type
      AND document_id = NEW.document_id
      AND id != NEW.id
      AND is_sticky = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;