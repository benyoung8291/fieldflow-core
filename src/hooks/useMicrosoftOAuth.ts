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
        // Fetch tokens from database with timeout
        const fetchWithTimeout = Promise.race([
          supabase
            .from("oauth_temp_tokens")
            .select("*")
            .eq("session_id", sessionId)
            .single(),
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

        if (data) {
          console.log("✅ OAuth tokens retrieved from database");
          
          // Clean up URL
          params.delete("microsoft_oauth_session");
          const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", newUrl);

          // Delete tokens from database (fire and forget)
          try {
            await supabase
              .from("oauth_temp_tokens")
              .delete()
              .eq("session_id", sessionId);
            console.log("Temp tokens deleted");
          } catch (deleteErr) {
            console.error("Failed to delete temp tokens:", deleteErr);
          }

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
