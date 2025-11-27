import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { sanitizeError } from "../_shared/errorHandler.ts";

const createPortalUserSchema = z.object({
  tenantId: z.string().uuid(),
  customerId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authenticate requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Verify user is tenant admin or has permission
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["tenant_admin", "super_admin"].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validated = createPortalUserSchema.parse(body);

    // Create user in auth.users
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: validated.firstName,
        last_name: validated.lastName,
      },
    });

    if (createUserError || !authData.user) {
      console.error("Error creating auth user:", createUserError);
      return new Response(
        JSON.stringify({ error: sanitizeError(createUserError, "create-auth-user") }),
        { status: 400 }
      );
    }

    // Create portal user record
    const { error: portalError } = await supabaseAdmin
      .from("customer_portal_users")
      .insert({
        tenant_id: validated.tenantId,
        customer_id: validated.customerId,
        user_id: authData.user.id,
        first_name: validated.firstName,
        last_name: validated.lastName,
        email: validated.email,
        phone: validated.phone,
        is_active: true,
        invited_at: new Date().toISOString(),
        invited_by: user.id,
      });

    if (portalError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error("Error creating portal user:", portalError);
      return new Response(
        JSON.stringify({ error: sanitizeError(portalError, "create-portal-user") }),
        { status: 400 }
      );
    }

    // Assign customer role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        tenant_id: validated.tenantId,
        role: "customer",
        customer_id: validated.customerId,
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      // Continue anyway, role can be fixed later
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        message: "Portal user created successfully",
      }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in create-customer-portal-user:", error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: error.errors }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ error: sanitizeError(error, "create-customer-portal-user") }),
      { status: 500 }
    );
  }
});
