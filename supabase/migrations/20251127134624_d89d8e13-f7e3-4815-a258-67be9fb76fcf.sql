-- Allow customer portal users to view ticket markups for their tickets
CREATE POLICY "Customer portal users can view their ticket markups"
ON public.ticket_markups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM customer_portal_users cpu
    JOIN helpdesk_tickets ht ON ht.id = ticket_markups.ticket_id
    WHERE cpu.user_id = auth.uid()
    AND cpu.customer_id = ht.customer_id
    AND cpu.is_active = true
  )
);

-- Allow customer portal users to view messages for their tickets
CREATE POLICY "Customer portal users can view their ticket messages"
ON public.helpdesk_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM customer_portal_users cpu
    JOIN helpdesk_tickets ht ON ht.id = helpdesk_messages.ticket_id
    WHERE cpu.user_id = auth.uid()
    AND cpu.customer_id = ht.customer_id
    AND cpu.is_active = true
  )
);