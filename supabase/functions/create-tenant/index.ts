import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeError } from "../_shared/errorHandler.ts";

const createTenantSchema = z.object({
  companyName: z.string().min(1, "Company name required").max(255, "Company name too long"),
  abn: z.string().optional(),
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  phone: z.string().max(50, "Phone too long").optional(),
  address: z.string().max(500, "Address too long").optional(),
  adminEmail: z.string().email("Invalid admin email").max(255, "Admin email too long"),
  adminPassword: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain uppercase letter")
    .regex(/[a-z]/, "Password must contain lowercase letter")
    .regex(/[0-9]/, "Password must contain number")
    .regex(/[^A-Za-z0-9]/, "Password must contain special character"),
  adminFirstName: z.string().trim().min(1, "First name required").max(100, "First name too long"),
  adminLastName: z.string().trim().max(100, "Last name too long").optional(),
  subscriptionPlan: z.string().optional(),
  monthlyPrice: z.number().optional(),
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

    // Check if user is super_admin
    const { data: superAdminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (roleError || !superAdminRole) {
      throw new Error("Unauthorized: Super admin access required");
    }

    const requestBody = await req.json();
    
    let validatedData;
    try {
      validatedData = createTenantSchema.parse(requestBody);
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        const errors = zodError.errors.map(err => err.message).join(". ");
        console.error("[create-tenant] Validation errors:", errors);
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
    
    const { 
      companyName, 
      abn, 
      email, 
      phone, 
      address, 
      adminEmail, 
      adminPassword, 
      adminFirstName, 
      adminLastName,
      subscriptionPlan,
      monthlyPrice,
    } = validatedData;

    console.log("[create-tenant] Creating tenant:", companyName);

    // Create the tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: companyName,
        abn: abn || null,
        email: email,
        phone: phone || null,
        address: address || null,
        subscription_status: "trial",
        subscription_plan: subscriptionPlan || null,
        billing_email: email,
        monthly_price: monthlyPrice || null,
        is_active: true,
      })
      .select()
      .single();

    if (tenantError) {
      console.error("[create-tenant] Tenant creation error:", tenantError);
      throw tenantError;
    }

    console.log("[create-tenant] Tenant created:", tenant.id);

    // Create the admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        first_name: adminFirstName,
        last_name: adminLastName || "",
      },
    });

    if (createError) {
      console.error("[create-tenant] Admin user creation error:", createError);
      throw createError;
    }

    console.log("[create-tenant] Admin user created:", newUser.user.id);

    // Update the admin user's tenant
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ tenant_id: tenant.id })
      .eq("id", newUser.user.id);

    if (updateError) {
      console.error("[create-tenant] Profile update error:", updateError);
      throw updateError;
    }

    // Assign tenant_admin role
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        tenant_id: tenant.id,
        role: "tenant_admin",
      });

    if (roleInsertError) {
      console.error("[create-tenant] Role assignment error:", roleInsertError);
      throw roleInsertError;
    }

    console.log("[create-tenant] Tenant setup complete");

    return new Response(
      JSON.stringify({ 
        success: true, 
        tenantId: tenant.id,
        adminUserId: newUser.user.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = sanitizeError(error, "create-tenant");
    console.error("[create-tenant] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
