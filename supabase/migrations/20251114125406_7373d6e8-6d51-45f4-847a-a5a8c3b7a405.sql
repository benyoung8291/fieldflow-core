-- Add foreign key from helpdesk_tickets to contacts table
ALTER TABLE helpdesk_tickets
ADD CONSTRAINT helpdesk_tickets_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;