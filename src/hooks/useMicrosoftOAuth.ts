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
        // Fetch tokens from database
        const { data, error } = await supabase
          .from("oauth_temp_tokens")
          .select("*")
          .eq("session_id", sessionId)
          .single();

        if (error) {
          console.error("Failed to fetch OAuth tokens:", error);
          return;
        }

        if (data) {
          console.log("✅ OAuth tokens retrieved from database");
          
          // Clean up URL
          params.delete("microsoft_oauth_session");
          const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", newUrl);

          // Delete tokens from database
          await supabase
            .from("oauth_temp_tokens")
            .delete()
            .eq("session_id", sessionId);

          const oauthData = {
            email: data.email,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            accountId: data.account_id,
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
      }
    }
  }, [onSuccess]);

  useEffect(() => {
    console.log("🎧 Checking for OAuth redirect callback");
    checkForOAuthCallback();
  }, [checkForOAuthCallback]);
}
