-- Enhanced auto-link function to handle customer, supplier, and lead relationships
CREATE OR REPLACE FUNCTION public.auto_link_ticket_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
  v_customer_id uuid;
  v_supplier_id uuid;
  v_lead_id uuid;
BEGIN
  -- Try to find matching contact by email (case-insensitive)
  IF NEW.sender_email IS NOT NULL THEN
    SELECT id, customer_id, supplier_id, lead_id 
    INTO v_contact_id, v_customer_id, v_supplier_id, v_lead_id
    FROM contacts
    WHERE tenant_id = NEW.tenant_id
      AND LOWER(email) = LOWER(NEW.sender_email)
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      NEW.contact_id := v_contact_id;
      NEW.customer_id := v_customer_id;
      NEW.supplier_id := v_supplier_id;
      NEW.lead_id := v_lead_id;
      
      -- Log for debugging
      RAISE NOTICE 'Auto-linked ticket % to contact % (customer: %, supplier: %, lead: %)', 
        NEW.id, v_contact_id, v_customer_id, v_supplier_id, v_lead_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;