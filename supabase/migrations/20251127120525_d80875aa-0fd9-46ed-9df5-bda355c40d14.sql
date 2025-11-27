-- Create Requests Help Desk Pipeline
INSERT INTO helpdesk_pipelines (tenant_id, name, description, color, display_order, is_active)
SELECT 
  id as tenant_id,
  'Requests' as name,
  'Customer portal requests requiring review and scheduling' as description,
  '#9333ea' as color,
  999 as display_order,
  true as is_active
FROM tenants
ON CONFLICT DO NOTHING;

-- Add appointment_id to helpdesk_tickets to link tickets to scheduled appointments
ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

-- Add completion report fields to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completion_notes text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS requires_completion_report boolean DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completion_reported_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completion_reported_by uuid REFERENCES profiles(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_appointment_id ON helpdesk_tickets(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_requires_completion ON appointments(requires_completion_report) WHERE requires_completion_report = true;

-- Add RLS policy for customer portal users to view their helpdesk tickets
CREATE POLICY "Customer portal users can view their tickets"
ON helpdesk_tickets FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customer_portal_users cpu
    WHERE cpu.user_id = auth.uid()
    AND cpu.customer_id = helpdesk_tickets.customer_id
  )
);