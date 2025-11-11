-- Drop existing tables if they have issues
DROP TABLE IF EXISTS public.helpdesk_messages CASCADE;
DROP TABLE IF EXISTS public.helpdesk_tickets CASCADE;
DROP TABLE IF EXISTS public.helpdesk_email_accounts CASCADE;
DROP TABLE IF EXISTS public.helpdesk_pipelines CASCADE;

-- Create help desk pipelines table (without foreign key on tenant_id)
CREATE TABLE public.helpdesk_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#0891B2',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create help desk email accounts table
CREATE TABLE public.helpdesk_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pipeline_id UUID REFERENCES public.helpdesk_pipelines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('resend', 'microsoft', 'imap')),
  resend_api_key TEXT,
  resend_domain TEXT,
  microsoft_client_id TEXT,
  microsoft_client_secret TEXT,
  microsoft_tenant_id TEXT,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create help desk tickets table
CREATE TABLE public.helpdesk_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pipeline_id UUID REFERENCES public.helpdesk_pipelines(id) ON DELETE SET NULL,
  email_account_id UUID REFERENCES public.helpdesk_email_accounts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL,
  ticket_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_message_id TEXT,
  email_thread_id TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ticket_number)
);

-- Create help desk messages table
CREATE TABLE public.helpdesk_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('email', 'note', 'status_change')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT,
  from_name TEXT,
  to_email TEXT,
  cc_email TEXT[],
  subject TEXT,
  body TEXT,
  html_body TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  email_message_id TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.helpdesk_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for helpdesk_pipelines
CREATE POLICY "Users can view pipelines in their tenant"
  ON public.helpdesk_pipelines FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create pipelines in their tenant"
  ON public.helpdesk_pipelines FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update pipelines in their tenant"
  ON public.helpdesk_pipelines FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete pipelines in their tenant"
  ON public.helpdesk_pipelines FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for helpdesk_email_accounts
CREATE POLICY "Users can view email accounts in their tenant"
  ON public.helpdesk_email_accounts FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage email accounts"
  ON public.helpdesk_email_accounts FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'tenant_admin'));

-- RLS Policies for helpdesk_tickets
CREATE POLICY "Users can view tickets in their tenant"
  ON public.helpdesk_tickets FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create tickets in their tenant"
  ON public.helpdesk_tickets FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update tickets in their tenant"
  ON public.helpdesk_tickets FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete tickets in their tenant"
  ON public.helpdesk_tickets FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for helpdesk_messages
CREATE POLICY "Users can view messages in their tenant"
  ON public.helpdesk_messages FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create messages in their tenant"
  ON public.helpdesk_messages FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update messages in their tenant"
  ON public.helpdesk_messages FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete messages in their tenant"
  ON public.helpdesk_messages FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Create indexes for performance
CREATE INDEX idx_helpdesk_pipelines_tenant ON public.helpdesk_pipelines(tenant_id);
CREATE INDEX idx_helpdesk_email_accounts_tenant ON public.helpdesk_email_accounts(tenant_id);
CREATE INDEX idx_helpdesk_tickets_tenant ON public.helpdesk_tickets(tenant_id);
CREATE INDEX idx_helpdesk_tickets_email_message_id ON public.helpdesk_tickets(email_message_id);
CREATE INDEX idx_helpdesk_messages_tenant ON public.helpdesk_messages(tenant_id);
CREATE INDEX idx_helpdesk_messages_ticket ON public.helpdesk_messages(ticket_id);

-- Add updated_at triggers
CREATE TRIGGER update_helpdesk_pipelines_updated_at
  BEFORE UPDATE ON public.helpdesk_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_helpdesk_email_accounts_updated_at
  BEFORE UPDATE ON public.helpdesk_email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_helpdesk_tickets_updated_at
  BEFORE UPDATE ON public.helpdesk_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();