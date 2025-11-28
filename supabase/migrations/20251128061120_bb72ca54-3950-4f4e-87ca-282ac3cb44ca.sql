-- Enable realtime for scheduler tables
-- This allows real-time updates across all users viewing the scheduler

-- Set REPLICA IDENTITY FULL to capture complete row data during updates
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.appointment_workers REPLICA IDENTITY FULL;
ALTER TABLE public.service_orders REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication (only if not already added)
DO $$
BEGIN
  -- Add appointments if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;

  -- Add appointment_workers if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'appointment_workers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_workers;
  END IF;
END $$;