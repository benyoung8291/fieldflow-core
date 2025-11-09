-- Add recurrence fields to service_orders
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT; -- 'daily', 'weekly', 'monthly'
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS recurrence_frequency INTEGER DEFAULT 1; -- every X days/weeks/months
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS recurrence_days_of_week TEXT[]; -- ['Monday', 'Tuesday', etc.]
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS parent_service_order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE;

-- Add recurrence fields to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT; -- 'daily', 'weekly', 'monthly'
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recurrence_frequency INTEGER DEFAULT 1;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS recurrence_days_of_week TEXT[];
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS parent_appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_service_orders_parent ON public.service_orders(parent_service_order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_parent ON public.appointments(parent_appointment_id);