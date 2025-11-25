-- Drop all existing overly permissive policies
DROP POLICY IF EXISTS "Users can view pipelines in their tenant" ON public.helpdesk_pipelines;
DROP POLICY IF EXISTS "Users can view tickets in their tenant" ON public.helpdesk_tickets;
DROP POLICY IF EXISTS "Users can view messages in their tenant" ON public.helpdesk_messages;

-- Keep the restrictive view policies we created
-- Users can only SELECT pipelines they are assigned to (or if admin)
-- The existing "Users can view assigned pipelines" policy is correct

-- For INSERT/UPDATE/DELETE operations, we still check tenant but also check assignment
DROP POLICY IF EXISTS "Users can create pipelines in their tenant" ON public.helpdesk_pipelines;
DROP POLICY IF EXISTS "Users can update pipelines in their tenant" ON public.helpdesk_pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines in their tenant" ON public.helpdesk_pipelines;

-- Only tenant_admins and super_admins can create/update/delete pipelines
CREATE POLICY "Admins can manage pipelines"
ON public.helpdesk_pipelines
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- For tickets: users can create/update tickets in pipelines they're assigned to
DROP POLICY IF EXISTS "Users can create tickets in their tenant" ON public.helpdesk_tickets;
DROP POLICY IF EXISTS "Users can update tickets in their tenant" ON public.helpdesk_tickets;
DROP POLICY IF EXISTS "Users can delete tickets in their tenant" ON public.helpdesk_tickets;

CREATE POLICY "Users can create tickets in assigned pipelines"
ON public.helpdesk_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_assigned_to_helpdesk_pipeline(auth.uid(), pipeline_id)
  OR public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Users can update tickets in assigned pipelines"
ON public.helpdesk_tickets
FOR UPDATE
TO authenticated
USING (
  public.is_assigned_to_helpdesk_pipeline(auth.uid(), pipeline_id)
  OR public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.is_assigned_to_helpdesk_pipeline(auth.uid(), pipeline_id)
  OR public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Users can delete tickets in assigned pipelines"
ON public.helpdesk_tickets
FOR DELETE
TO authenticated
USING (
  public.is_assigned_to_helpdesk_pipeline(auth.uid(), pipeline_id)
  OR public.has_role(auth.uid(), 'tenant_admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- For messages: users can create/update messages for tickets in pipelines they're assigned to
DROP POLICY IF EXISTS "Users can create messages in their tenant" ON public.helpdesk_messages;
DROP POLICY IF EXISTS "Users can update messages in their tenant" ON public.helpdesk_messages;
DROP POLICY IF EXISTS "Users can delete messages in their tenant" ON public.helpdesk_messages;

CREATE POLICY "Users can create messages in assigned pipelines"
ON public.helpdesk_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.helpdesk_tickets
    WHERE helpdesk_tickets.id = helpdesk_messages.ticket_id
    AND (
      public.is_assigned_to_helpdesk_pipeline(auth.uid(), helpdesk_tickets.pipeline_id)
      OR public.has_role(auth.uid(), 'tenant_admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);

CREATE POLICY "Users can update messages in assigned pipelines"
ON public.helpdesk_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.helpdesk_tickets
    WHERE helpdesk_tickets.id = helpdesk_messages.ticket_id
    AND (
      public.is_assigned_to_helpdesk_pipeline(auth.uid(), helpdesk_tickets.pipeline_id)
      OR public.has_role(auth.uid(), 'tenant_admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.helpdesk_tickets
    WHERE helpdesk_tickets.id = helpdesk_messages.ticket_id
    AND (
      public.is_assigned_to_helpdesk_pipeline(auth.uid(), helpdesk_tickets.pipeline_id)
      OR public.has_role(auth.uid(), 'tenant_admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);

CREATE POLICY "Users can delete messages in assigned pipelines"
ON public.helpdesk_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.helpdesk_tickets
    WHERE helpdesk_tickets.id = helpdesk_messages.ticket_id
    AND (
      public.is_assigned_to_helpdesk_pipeline(auth.uid(), helpdesk_tickets.pipeline_id)
      OR public.has_role(auth.uid(), 'tenant_admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);