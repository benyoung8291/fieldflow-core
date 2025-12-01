-- Add location_id to helpdesk_tickets
ALTER TABLE helpdesk_tickets 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES customer_locations(id);

-- Add contact_id to customer_portal_users
ALTER TABLE customer_portal_users 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_location_id ON helpdesk_tickets(location_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_users_contact_id ON customer_portal_users(contact_id);