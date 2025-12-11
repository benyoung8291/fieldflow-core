-- Add email_signature to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_signature text;

-- Create email_snippets table for reusable text snippets
CREATE TABLE public.email_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  is_shared BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_snippets ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_snippets
CREATE POLICY "Users can view snippets in their tenant"
ON public.email_snippets FOR SELECT
USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create snippets in their tenant"
ON public.email_snippets FOR INSERT
WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their own snippets"
ON public.email_snippets FOR UPDATE
USING (created_by = auth.uid() OR is_shared = true);

CREATE POLICY "Users can delete their own snippets"
ON public.email_snippets FOR DELETE
USING (created_by = auth.uid());

-- Index for faster lookups
CREATE INDEX idx_email_snippets_tenant_id ON public.email_snippets(tenant_id);
CREATE INDEX idx_email_snippets_category ON public.email_snippets(category);