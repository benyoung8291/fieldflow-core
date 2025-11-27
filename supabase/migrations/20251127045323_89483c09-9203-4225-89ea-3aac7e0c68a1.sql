-- Add password reset tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS needs_password_reset boolean DEFAULT true;

-- Set existing users to not need password reset
UPDATE public.profiles 
SET needs_password_reset = false 
WHERE needs_password_reset IS NULL;

-- Comment explaining the column
COMMENT ON COLUMN public.profiles.needs_password_reset IS 'Tracks whether user needs to reset their initial password on first login';