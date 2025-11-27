import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeError } from "../_shared/errorHandler.ts";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain uppercase letter")
    .regex(/[a-z]/, "Password must contain lowercase letter")
    .regex(/[0-9]/, "Password must contain number")
    .regex(/[^A-Za-z0-9]/, "Password must contain special character"),
  firstName: z.string().trim().min(1, "First name required").max(100, "First name too long"),
  lastName: z.string().trim().max(100, "Last name too long").optional(),
  role: z.enum(["tenant_admin", "supervisor", "worker"]).optional()
});

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

    const requestBody = await req.json();
    
    let validatedData;
    try {
      validatedData = createUserSchema.parse(requestBody);
    } catch (zodError) {
      // Return detailed validation errors to the user
      if (zodError instanceof z.ZodError) {
        const errors = zodError.errors.map(err => err.message).join(". ");
        console.error("[create-tenant-user] Validation errors:", errors);
        return new Response(
          JSON.stringify({ error: errors }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
      throw zodError;
    }
    
    const { email, firstName, lastName, role, password } = validatedData;

    // Create the new user with tenant_id in metadata - trigger will handle profile creation atomically
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName || "",
        tenant_id: profile.tenant_id,
      },
    });

    if (createError) {
      throw createError;
    }

    // Profile with tenant_id is created atomically by handle_new_user trigger

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
