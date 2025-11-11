import { useEffect, useCallback } from "react";

interface OAuthCallbackData {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  accountId: string;
}

/**
 * Global Microsoft OAuth message listener hook
 * This ensures OAuth callbacks are received even if dialogs are closed
 */
export function useMicrosoftOAuth(
  onSuccess: (data: OAuthCallbackData) => void
) {
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      console.log("🎧 Global OAuth listener received message:", {
        origin: event.origin,
        hasData: !!event.data,
        dataType: typeof event.data,
      });

      // Check if this is our OAuth callback message
      if (event.data && typeof event.data === "object") {
        const { email, accessToken, refreshToken, expiresIn, accountId } =
          event.data;

        if (accessToken && refreshToken && email) {
          console.log("✅ Valid OAuth data received globally!");
          console.log("  Email:", email);
          console.log("  Account ID:", accountId);

          // Call the success callback
          onSuccess({
            email,
            accessToken,
            refreshToken,
            expiresIn,
            accountId,
          });
        } else {
          console.log(
            "⚠️ Message missing OAuth fields:",
            { email, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken }
          );
        }
      }
    },
    [onSuccess]
  );

  useEffect(() => {
    console.log("🎧 Setting up GLOBAL Microsoft OAuth listener");
    window.addEventListener("message", handleMessage, false);

    return () => {
      console.log("🔇 Removing GLOBAL Microsoft OAuth listener");
      window.removeEventListener("message", handleMessage, false);
    };
  }, [handleMessage]);
}
