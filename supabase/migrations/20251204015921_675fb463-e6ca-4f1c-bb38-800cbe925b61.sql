-- Make worker_id nullable to allow subcontractor-only assignments
ALTER TABLE public.appointment_workers
ALTER COLUMN worker_id DROP NOT NULL;