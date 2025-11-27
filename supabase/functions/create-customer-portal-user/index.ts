import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.msg) return error.msg;
  return 'An unexpected error occurred';
}

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
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("Starting create-customer-portal-user function");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authenticate requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization" }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Verify user is tenant admin or has permission
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasPermission = userRoles?.some(r => 
      ["tenant_admin", "super_admin"].includes(r.role)
    );

    if (!hasPermission) {
      console.error("Insufficient permissions. User roles:", userRoles?.map(r => r.role));
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User authorized with roles:", userRoles?.map(r => r.role));

    // Parse and validate request body
    const body = await req.json();
    console.log("Request body received:", { ...body, password: "[REDACTED]" });
    const validated = createPortalUserSchema.parse(body);
    console.log("Validation successful");

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
        JSON.stringify({ error: getErrorMessage(createUserError) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Auth user created:", authData.user.id);

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
      console.error("Error creating portal user:", portalError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: getErrorMessage(portalError) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Portal user created");

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

    console.log("Customer portal user created successfully");
    
    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        message: "Portal user created successfully",
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in create-customer-portal-user:", error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
