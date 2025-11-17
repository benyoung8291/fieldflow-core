-- Create ABN validation cache table to speed up repeated lookups
CREATE TABLE IF NOT EXISTS public.abn_validation_cache (
  abn TEXT PRIMARY KEY,
  valid BOOLEAN NOT NULL,
  legal_name TEXT,
  trading_names TEXT[],
  entity_type TEXT,
  gst_registered BOOLEAN,
  status TEXT,
  last_updated TEXT,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Create index for expiry-based cleanup
CREATE INDEX IF NOT EXISTS idx_abn_cache_expires ON public.abn_validation_cache(expires_at);

-- Enable RLS
ALTER TABLE public.abn_validation_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read from cache
CREATE POLICY "Allow authenticated users to read ABN cache"
  ON public.abn_validation_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert into cache (edge function will do this)
CREATE POLICY "Allow authenticated users to insert ABN cache"
  ON public.abn_validation_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update cache
CREATE POLICY "Allow authenticated users to update ABN cache"
  ON public.abn_validation_cache
  FOR UPDATE
  TO authenticated
  USING (true);