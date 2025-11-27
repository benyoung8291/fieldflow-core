-- Allow customer portal users to insert helpdesk tickets for their customer
CREATE POLICY "Customer portal users can create tickets"
ON public.helpdesk_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM customer_portal_users cpu
    WHERE cpu.user_id = auth.uid()
    AND cpu.tenant_id = helpdesk_tickets.tenant_id
    AND cpu.customer_id = helpdesk_tickets.customer_id
    AND cpu.is_active = true
  )
);