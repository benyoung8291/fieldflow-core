-- Enable realtime for helpdesk tables
ALTER TABLE public.helpdesk_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.helpdesk_messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.helpdesk_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.helpdesk_messages;