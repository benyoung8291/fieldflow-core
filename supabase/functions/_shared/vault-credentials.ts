import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface XeroCredentials {
  client_secret: string;
  refresh_token: string;
  access_token: string | null;
}

export interface MicrosoftCredentials {
  client_secret: string | null;
  refresh_token: string;
  access_token: string;
}

export interface AcumaticaCredentials {
  username: string;
  password: string;
}

/**
 * Get Xero credentials from vault for a given integration
 */
export async function getXeroCredentials(
  supabase: SupabaseClient,
  integrationId: string
): Promise<XeroCredentials> {
  const { data, error } = await supabase
    .rpc("get_xero_credentials", { integration_id: integrationId })
    .single();

  if (error || !data) {
    throw new Error("Failed to retrieve Xero credentials from vault");
  }

  const credentials = data as { 
    client_secret: string | null; 
    refresh_token: string | null; 
    access_token: string | null;
  };

  if (!credentials.client_secret || !credentials.refresh_token) {
    throw new Error("Xero credentials not properly configured");
  }

  return {
    client_secret: credentials.client_secret,
    refresh_token: credentials.refresh_token,
    access_token: credentials.access_token,
  };
}

/**
 * Update Xero tokens in vault after refresh
 */
export async function updateXeroTokens(
  supabase: SupabaseClient,
  integrationId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const { error } = await supabase.rpc("update_xero_tokens", {
    integration_id: integrationId,
    new_access_token: accessToken,
    new_refresh_token: refreshToken,
  });

  if (error) {
    throw new Error("Failed to update Xero tokens in vault");
  }
}

/**
 * Get Microsoft credentials from vault for a given email account
 */
export async function getMicrosoftCredentials(
  supabase: SupabaseClient,
  emailAccountId: string
): Promise<MicrosoftCredentials> {
  const { data, error } = await supabase
    .rpc("get_microsoft_credentials", { email_account_id: emailAccountId })
    .single();

  if (error || !data) {
    throw new Error("Failed to retrieve Microsoft credentials from vault");
  }

  const credentials = data as { 
    client_secret: string | null; 
    refresh_token: string | null; 
    access_token: string | null;
  };

  if (!credentials.refresh_token || !credentials.access_token) {
    throw new Error("Microsoft credentials not properly configured");
  }

  return {
    client_secret: credentials.client_secret,
    refresh_token: credentials.refresh_token,
    access_token: credentials.access_token,
  };
}

/**
 * Update Microsoft tokens in vault after refresh
 */
export async function updateMicrosoftTokens(
  supabase: SupabaseClient,
  emailAccountId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const { error } = await supabase.rpc("update_microsoft_tokens", {
    email_account_id: emailAccountId,
    new_access_token: accessToken,
    new_refresh_token: refreshToken,
  });

  if (error) {
    throw new Error("Failed to update Microsoft tokens in vault");
  }
}

/**
 * Get Acumatica credentials from vault for a given integration
 */
export async function getAcumaticaCredentials(
  supabase: SupabaseClient,
  integrationId: string
): Promise<AcumaticaCredentials> {
  // Get username from integration record
  const { data: integration, error: intError } = await supabase
    .from("accounting_integrations")
    .select("acumatica_username")
    .eq("id", integrationId)
    .single();

  if (intError || !integration) {
    throw new Error("Failed to retrieve integration record");
  }

  // Get password from vault
  const { data: password, error: passError } = await supabase
    .rpc("get_acumatica_password", { integration_id: integrationId })
    .single();

  if (passError || !password) {
    throw new Error("Failed to retrieve Acumatica password from vault");
  }

  if (!integration.acumatica_username || !password) {
    throw new Error("Acumatica credentials not properly configured");
  }

  return {
    username: integration.acumatica_username,
    password: password as string,
  };
}