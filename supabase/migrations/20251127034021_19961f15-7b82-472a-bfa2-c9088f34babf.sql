-- Add customer_id to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_customer_id ON public.tasks(customer_id);