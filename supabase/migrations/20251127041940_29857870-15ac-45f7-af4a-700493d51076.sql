-- Check if workers table exists and add state/phone columns
-- First, let's see if we need to modify an existing workers table or create one
DO $$ 
BEGIN
  -- Add state column to profiles if not exists (for workers)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'worker_state'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN worker_state text;
  END IF;

  -- Add phone column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'worker_phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN worker_phone text;
  END IF;
END $$;

-- Migrate existing data from state and phone to worker_state and worker_phone
UPDATE public.profiles 
SET worker_state = state, worker_phone = phone
WHERE state IS NOT NULL OR phone IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.profiles.worker_state IS 'Australian state where the worker is based (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)';
COMMENT ON COLUMN public.profiles.worker_phone IS 'Contact phone number for the worker';