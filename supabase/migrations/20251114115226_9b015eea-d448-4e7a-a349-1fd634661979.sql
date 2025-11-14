-- Add relationship fields to helpdesk_tickets
ALTER TABLE helpdesk_tickets 
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id),
ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id),
ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES service_contracts(id),
ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES purchase_orders(id),
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_contact_id ON helpdesk_tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_lead_id ON helpdesk_tickets(lead_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_contract_id ON helpdesk_tickets(contract_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_purchase_order_id ON helpdesk_tickets(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_supplier_id ON helpdesk_tickets(supplier_id);

-- Function to auto-link contact based on sender email
CREATE OR REPLACE FUNCTION auto_link_ticket_contact()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id uuid;
  v_customer_id uuid;
BEGIN
  -- Try to find matching contact by email
  IF NEW.sender_email IS NOT NULL THEN
    SELECT id, customer_id INTO v_contact_id, v_customer_id
    FROM contacts
    WHERE tenant_id = NEW.tenant_id
      AND LOWER(email) = LOWER(NEW.sender_email)
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      NEW.contact_id := v_contact_id;
      NEW.customer_id := v_customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-linking
DROP TRIGGER IF EXISTS trigger_auto_link_ticket_contact ON helpdesk_tickets;
CREATE TRIGGER trigger_auto_link_ticket_contact
  BEFORE INSERT OR UPDATE ON helpdesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_ticket_contact();

COMMENT ON FUNCTION auto_link_ticket_contact() IS 'Automatically links tickets to contacts based on sender email address';