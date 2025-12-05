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

    // Get user's tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error("User has no tenant");
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    // Get integration ID
    const { data: integration } = await supabase
      .from("accounting_integrations")
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", "myob_acumatica")
      .single();

    if (!integration) {
      throw new Error("Acumatica integration not found. Please save integration settings first.");
    }

    console.log("Storing credentials for integration:", integration.id);

    // Store credentials using vault encryption
    const { error: storeError } = await supabase
      .rpc("store_acumatica_credentials", {
        integration_id: integration.id,
        username: username,
        password: password,
      });

    if (storeError) {
      console.error("Error storing credentials:", storeError);
      throw new Error("Failed to store credentials securely");
    }

    // Update the acumatica_password field to indicate encrypted storage
    const { error: updateError } = await supabase
      .from("accounting_integrations")
      .update({ 
        acumatica_password: "[ENCRYPTED]",
        acumatica_username: username 
      })
      .eq("id", integration.id);

    if (updateError) {
      console.error("Error updating integration record:", updateError);
      // Non-critical - credentials are stored in vault
    }

    console.log("Credentials stored securely in vault for tenant:", profile.tenant_id);

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
