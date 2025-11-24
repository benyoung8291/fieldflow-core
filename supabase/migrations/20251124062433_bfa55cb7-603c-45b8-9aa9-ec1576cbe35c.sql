-- Function to retroactively link existing tickets to contacts
CREATE OR REPLACE FUNCTION public.link_existing_tickets_to_contacts()
RETURNS TABLE(tickets_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated_count integer := 0;
  v_ticket record;
  v_contact record;
BEGIN
  -- Find all tickets that have sender_email but no contact_id
  FOR v_ticket IN 
    SELECT id, tenant_id, sender_email
    FROM helpdesk_tickets
    WHERE sender_email IS NOT NULL
      AND contact_id IS NULL
  LOOP
    -- Try to find matching contact
    SELECT id, customer_id, supplier_id, lead_id
    INTO v_contact
    FROM contacts
    WHERE tenant_id = v_ticket.tenant_id
      AND LOWER(email) = LOWER(v_ticket.sender_email)
    LIMIT 1;
    
    -- Update ticket if contact found
    IF v_contact.id IS NOT NULL THEN
      UPDATE helpdesk_tickets
      SET 
        contact_id = v_contact.id,
        customer_id = v_contact.customer_id,
        supplier_id = v_contact.supplier_id,
        lead_id = v_contact.lead_id,
        updated_at = now()
      WHERE id = v_ticket.id;
      
      v_updated_count := v_updated_count + 1;
      
      RAISE NOTICE 'Linked ticket % to contact %', v_ticket.id, v_contact.id;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_updated_count;
END;
$function$;

-- Run the function to link all existing tickets
SELECT link_existing_tickets_to_contacts();