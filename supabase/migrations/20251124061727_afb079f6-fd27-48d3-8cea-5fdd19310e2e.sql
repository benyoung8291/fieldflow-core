-- Add index on contacts email for fast lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON contacts (LOWER(email));

-- Ensure the auto-link trigger is attached to helpdesk_tickets
DROP TRIGGER IF EXISTS auto_link_ticket_contact_trigger ON helpdesk_tickets;

CREATE TRIGGER auto_link_ticket_contact_trigger
  BEFORE INSERT OR UPDATE OF sender_email ON helpdesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_ticket_contact();