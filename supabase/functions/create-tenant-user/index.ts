import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeError } from "../_shared/errorHandler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get requesting user's tenant
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("User profile not found");
    }

    // Check if user is tenant admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "tenant_admin")
      .single();

    if (!adminRole) {
      throw new Error("Unauthorized: Admin access required");
    }

    const { email, firstName, lastName, role, password } = await req.json();

    if (!email || !firstName || !password) {
      throw new Error("Email, first name, and password are required");
    }

    // Create the new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName || "",
      },
    });

    if (createError) {
      throw createError;
    }

    // Update the new user's tenant
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ tenant_id: profile.tenant_id })
      .eq("id", newUser.user.id);

    if (updateError) {
      throw updateError;
    }

    // Assign initial role if provided
    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: newUser.user.id,
          tenant_id: profile.tenant_id,
          role: role,
        });

      if (roleError) {
        throw roleError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUser.user.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
} catch (error) {
  const message = sanitizeError(error, "create-tenant-user");
  return new Response(
    JSON.stringify({ error: message }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    }
  );
}
});
