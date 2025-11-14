-- Add status fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available' CHECK (status IN ('available', 'busy', 'away')),
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS auto_away_minutes INTEGER DEFAULT 5;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.status IS 'User availability status: available, busy, or away';
COMMENT ON COLUMN public.profiles.auto_away_minutes IS 'Minutes of inactivity before automatically setting status to away';