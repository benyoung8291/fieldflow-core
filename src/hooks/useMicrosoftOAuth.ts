import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OAuthCallbackData {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  accountId: string;
}

/**
 * Global Microsoft OAuth redirect handler hook
 * Checks URL for OAuth session ID and fetches tokens from database
 */
export function useMicrosoftOAuth(
  onSuccess: (data: OAuthCallbackData) => void
) {
  const checkForOAuthCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("microsoft_oauth_session");

    if (sessionId) {
      console.log("🔍 Found OAuth session ID in URL:", sessionId);
      
      try {
        // Fetch tokens using secure RPC function with timeout
        const fetchWithTimeout = Promise.race([
          supabase.rpc('get_oauth_token_by_session', { p_session_id: sessionId }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("OAuth token fetch timeout")), 5000)
          )
        ]);

        const { data, error } = await fetchWithTimeout as any;

        if (error) {
          console.error("Failed to fetch OAuth tokens:", error);
          // Clean up URL even on error
          params.delete("microsoft_oauth_session");
          const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", newUrl);
          return;
        }

        // RPC function returns an array, get the first result
        const tokenData = data?.[0];

        if (tokenData) {
          console.log("✅ OAuth tokens retrieved securely");
          
          // Clean up URL
          params.delete("microsoft_oauth_session");
          const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", newUrl);

          // Note: Tokens are automatically cleaned up by the cleanup-oauth-tokens edge function
          // No need to delete manually (user doesn't have permission)

          const oauthData = {
            email: tokenData.email,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            accountId: tokenData.account_id,
          };

          // Store in sessionStorage as backup
          sessionStorage.setItem('ms_oauth_data', JSON.stringify(oauthData));

          // Dispatch custom event for settings page
          const event = new CustomEvent('ms_oauth_success', { detail: oauthData });
          window.dispatchEvent(event);

          // Call success callback
          onSuccess(oauthData);
        }
      } catch (err) {
        console.error("Error processing OAuth callback:", err);
        // Clean up URL even on error
        params.delete("microsoft_oauth_session");
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [onSuccess]);

  useEffect(() => {
    console.log("🎧 Checking for OAuth redirect callback");
    checkForOAuthCallback();
  }, [checkForOAuthCallback]);
}
