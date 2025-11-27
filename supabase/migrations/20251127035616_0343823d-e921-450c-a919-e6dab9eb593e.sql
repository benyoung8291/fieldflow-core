-- Add state column to profiles table for worker location filtering
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT;