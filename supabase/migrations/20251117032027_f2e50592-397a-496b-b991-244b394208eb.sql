-- Add foreign key constraints for leads table to profiles
ALTER TABLE public.leads 
  DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey,
  DROP CONSTRAINT IF EXISTS leads_created_by_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL,
  ADD CONSTRAINT leads_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;