-- Create app_config table for storing application configuration including build timestamps
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable public read access (anyone can check the current version)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to app_config" 
ON public.app_config 
FOR SELECT 
USING (true);

-- Only authenticated users with proper permissions can update (will be done via edge function with service role)
CREATE POLICY "Allow service role to manage app_config" 
ON public.app_config 
FOR ALL 
USING (auth.role() = 'service_role');

-- Insert initial build timestamp
INSERT INTO public.app_config (key, value) 
VALUES ('build_timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();