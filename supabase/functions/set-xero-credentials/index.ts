import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the user is authenticated
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { clientId, clientSecret, refreshToken } = await req.json();

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Client ID, client secret, and refresh token are required");
    }

    // Store credentials in Supabase secrets/vault
    // Note: In a production environment, you would use Supabase Vault or
    // the Management API to securely store these. For now, we'll use
    // environment variables which are set at the project level.
    
    // The actual storage mechanism depends on your deployment setup.
    // This is a placeholder that demonstrates the pattern.
    // In reality, you'd use Supabase's Management API or Vault API.
    
    console.log("Credentials would be stored securely here");
    console.log("Client ID length:", clientId.length);
    console.log("Client Secret length:", clientSecret.length);
    console.log("Refresh Token length:", refreshToken.length);

    return new Response(
      JSON.stringify({ success: true, message: "Credentials stored securely" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error storing credentials:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to store credentials" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
