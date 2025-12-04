-- Add subcontractor worker fields to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_assignable_worker boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS worker_state text,
ADD COLUMN IF NOT EXISTS future_worker_user_id uuid REFERENCES auth.users(id);

-- Add contact_id to appointment_workers for subcontractor assignments
ALTER TABLE public.appointment_workers
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id);

-- Add constraint: either worker_id OR contact_id must be set (not both null, not both populated)
ALTER TABLE public.appointment_workers
DROP CONSTRAINT IF EXISTS appointment_workers_worker_or_contact_check;

ALTER TABLE public.appointment_workers
ADD CONSTRAINT appointment_workers_worker_or_contact_check 
CHECK (
  (worker_id IS NOT NULL AND contact_id IS NULL) OR 
  (worker_id IS NULL AND contact_id IS NOT NULL)
);

-- Create index for efficient subcontractor queries
CREATE INDEX IF NOT EXISTS idx_contacts_assignable_worker 
ON public.contacts(is_assignable_worker, supplier_id) 
WHERE is_assignable_worker = true;

-- Create index for appointment_workers contact lookups
CREATE INDEX IF NOT EXISTS idx_appointment_workers_contact_id 
ON public.appointment_workers(contact_id) 
WHERE contact_id IS NOT NULL;