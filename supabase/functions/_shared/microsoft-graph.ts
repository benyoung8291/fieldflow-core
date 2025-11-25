/**
 * Microsoft Graph API Helper Module
 * Provides centralized, secure, and optimized access to Microsoft Graph API
 * Following industry best practices for OAuth2, error handling, and retry logic
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============= Configuration =============
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh tokens 5 minutes before expiry
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_DELAY_MS = 2000;

// ============= Types =============
export interface GraphAPIConfig {
  emailAccountId: string;
  supabaseClient: any; // Use any for edge functions compatibility
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// ============= Error Classes =============
export class GraphAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "GraphAPIError";
  }
}

export class TokenRefreshError extends GraphAPIError {
  constructor(message: string) {
    super(message, 401, false);
    this.name = "TokenRefreshError";
  }
}

// ============= Token Management =============
/**
 * Gets a valid access token, refreshing if necessary
 * Uses atomic updates to prevent race conditions
 */
export async function getValidAccessToken(
  config: GraphAPIConfig
): Promise<string> {
  const { supabaseClient, emailAccountId } = config;

  // Get account with token expiry info
  const { data: account, error: accountError } = await supabaseClient
    .from("helpdesk_email_accounts")
    .select("microsoft_token_expires_at, tenant_id")
    .eq("id", emailAccountId)
    .single();

  if (accountError || !account) {
    throw new GraphAPIError("Email account not found", 404, false);
  }

  // Check if token needs refresh
  const expiresAt = new Date(account.microsoft_token_expires_at);
  const now = new Date();
  const needsRefresh = expiresAt.getTime() - now.getTime() < TOKEN_REFRESH_BUFFER_MS;

  // Get credentials from vault
  const { data: credentials, error: credError } = await supabaseClient
    .rpc("get_microsoft_credentials", { email_account_id: emailAccountId })
    .single();

  const msCredentials = credentials as { client_secret: string | null; refresh_token: string | null; access_token: string | null } | null;

  if (credError || !msCredentials || !msCredentials.access_token) {
    throw new GraphAPIError("Microsoft credentials not found", 404, false);
  }

  if (!needsRefresh) {
    return msCredentials.access_token;
  }

  // Refresh token with atomic update
  console.log("🔄 Refreshing access token for account:", emailAccountId);
  
  if (!msCredentials.refresh_token) {
    throw new TokenRefreshError("Refresh token not found");
  }

  const tokenData = await refreshAccessToken({
    refreshToken: msCredentials.refresh_token,
    clientSecret: msCredentials.client_secret || Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
  });

  // Update tokens in vault using RPC
  const { error: updateError } = await supabaseClient
    .rpc("update_microsoft_tokens", {
      email_account_id: emailAccountId,
      new_access_token: tokenData.accessToken,
      new_refresh_token: tokenData.refreshToken,
    });

  if (updateError) {
    console.error("Failed to update tokens:", updateError);
    throw new GraphAPIError("Failed to persist refreshed token", 500, true);
  }

  // Update expiry time on the table
  await supabaseClient
    .from("helpdesk_email_accounts")
    .update({
      microsoft_token_expires_at: tokenData.expiresAt.toISOString(),
      sync_error: null,
    })
    .eq("id", emailAccountId);

  console.log("✅ Token refreshed successfully");
  return tokenData.accessToken;
}

/**
 * Refreshes Microsoft OAuth token
 */
async function refreshAccessToken(params: {
  refreshToken: string;
  clientSecret: string;
}): Promise<TokenData> {
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const tenantId = Deno.env.get("MICROSOFT_TENANT_ID");

  if (!clientId || !tenantId) {
    throw new TokenRefreshError("Microsoft OAuth not configured");
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: params.clientSecret,
        grant_type: "refresh_token",
        refresh_token: params.refreshToken,
        scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token refresh failed:", errorText);
    throw new TokenRefreshError("Microsoft authentication expired. Please reconnect your email account.");
  }

  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || params.refreshToken, // Use existing if not returned
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// ============= API Request Helpers =============
/**
 * Makes a Graph API request with automatic retry and error handling
 */
export async function graphAPIRequest<T>(
  config: GraphAPIConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getValidAccessToken(config);
  const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_API_BASE}${endpoint}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "2") * 1000;
        console.warn(`Rate limited, waiting ${retryAfter}ms...`);
        await sleep(retryAfter);
        continue;
      }

      // Handle token expiration (401) - refresh and retry once
      if (response.status === 401 && attempt === 1) {
        console.log("Token expired mid-request, refreshing...");
        // Force token refresh by setting expiry to past
        await config.supabaseClient
          .from("helpdesk_email_accounts")
          .update({ microsoft_token_expires_at: new Date(0).toISOString() })
          .eq("id", config.emailAccountId);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new GraphAPIError(
          `Graph API error: ${response.status} ${errorText}`,
          response.status,
          response.status >= 500 || response.status === 429
        );
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return null as T;
      }

      const data = await response.json();
      return data as T;

    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof GraphAPIError && !error.retryable) {
        throw error;
      }

      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new GraphAPIError("Request failed after retries", 500, false);
}

/**
 * Fetches messages with pagination support
 */
export async function fetchMessages(
  config: GraphAPIConfig,
  mailboxEmail: string,
  options: {
    top?: number;
    skip?: number;
    orderBy?: string;
    filter?: string;
  } = {}
): Promise<any[]> {
  const queryParams = new URLSearchParams({
    $top: String(options.top || 50),
    $skip: String(options.skip || 0),
    $orderby: options.orderBy || "receivedDateTime desc",
    $select: "id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead,conversationId,internetMessageId,internetMessageHeaders,hasAttachments",
    $expand: "attachments",
  });

  if (options.filter) {
    queryParams.set("$filter", options.filter);
  }

  const endpoint = `/users/${mailboxEmail}/mailFolders/inbox/messages?${queryParams}`;
  const response = await graphAPIRequest<{ value: any[] }>(config, endpoint);
  
  return response.value || [];
}

/**
 * Sends an email via Graph API
 */
export async function sendEmail(
  config: GraphAPIConfig,
  mailboxEmail: string,
  message: {
    subject: string;
    body: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    conversationId?: string;
  }
): Promise<void> {
  const emailPayload = {
    message: {
      subject: message.subject,
      body: {
        contentType: "HTML",
        content: message.body,
      },
      toRecipients: message.to.map(email => ({ emailAddress: { address: email } })),
      ...(message.cc && message.cc.length > 0 && {
        ccRecipients: message.cc.map(email => ({ emailAddress: { address: email } })),
      }),
      ...(message.bcc && message.bcc.length > 0 && {
        bccRecipients: message.bcc.map(email => ({ emailAddress: { address: email } })),
      }),
      ...(message.replyTo && {
        internetMessageId: message.replyTo,
      }),
      ...(message.conversationId && {
        conversationId: message.conversationId,
      }),
    },
    saveToSentItems: true,
  };

  const endpoint = `/users/${mailboxEmail}/sendMail`;
  await graphAPIRequest(config, endpoint, {
    method: "POST",
    body: JSON.stringify(emailPayload),
  });
}

// ============= Utilities =============
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates email account has required Microsoft permissions
 */
export async function validateAccountPermissions(
  config: GraphAPIConfig,
  mailboxEmail: string
): Promise<boolean> {
  try {
    // Try to access inbox to verify permissions
    await graphAPIRequest(config, `/users/${mailboxEmail}/mailFolders/inbox`);
    return true;
  } catch (error) {
    console.error("Permission validation failed:", error);
    return false;
  }
}
