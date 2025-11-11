import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken } = await req.json();

    if (!accessToken) {
      throw new Error("Access token is required");
    }

    // Test the connection by fetching user profile
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Microsoft Graph API error:", errorData);
      throw new Error("Failed to connect to Microsoft account");
    }

    const profile = await response.json();
    const email = profile.mail || profile.userPrincipalName;

    console.log("Connection test successful for:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        email,
        displayName: profile.displayName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in microsoft-test-connection:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});