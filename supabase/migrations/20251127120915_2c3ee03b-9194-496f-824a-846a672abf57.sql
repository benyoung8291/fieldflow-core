-- Make ticket_number optional for customer portal submissions
ALTER TABLE helpdesk_tickets ALTER COLUMN ticket_number DROP NOT NULL;

-- Create ticket_markups table to store floor plan markups
CREATE TABLE IF NOT EXISTS ticket_markups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
  floor_plan_id uuid NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  pin_x numeric NOT NULL,
  pin_y numeric NOT NULL,
  markup_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ticket_markups ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_markups
CREATE POLICY "Users can view markups for their tickets"
ON ticket_markups FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM helpdesk_tickets ht
    WHERE ht.id = ticket_markups.ticket_id
    AND (
      ht.customer_id IN (
        SELECT customer_id FROM customer_portal_users WHERE user_id = auth.uid()
      )
      OR ht.tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Customer portal users can insert markups"
ON ticket_markups FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customer_portal_users
    WHERE user_id = auth.uid()
    AND tenant_id = ticket_markups.tenant_id
  )
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_ticket_markups_ticket_id ON ticket_markups(ticket_id);