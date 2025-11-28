import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, getValidAccessToken } from "../_shared/microsoft-graph.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, firstName, lastName, phone, tenantId } = await req.json();

    if (!email || !password || !firstName || !lastName || !tenantId) {
      throw new Error("Missing required fields");
    }

    // Create Supabase admin client
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

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("User creation failed");

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      tenant_id: tenantId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      is_active: true,
    });

    if (profileError) throw profileError;

    // Add worker role
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      tenant_id: tenantId,
      role: "worker",
    });

    if (roleError) throw roleError;

    // Send welcome email via Microsoft Graph
    try {
      // Get the clientservices email account
      const { data: emailAccount } = await supabaseAdmin
        .from("helpdesk_email_accounts")
        .select("id")
        .eq("email_address", "clientservices@premrest.com.au")
        .eq("is_active", true)
        .single();

      if (emailAccount) {
        const graphConfig = {
          emailAccountId: emailAccount.id,
          supabaseClient: supabaseAdmin,
        };

        const welcomeEmailBody = `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #d1703c;">Welcome to Premrest!</h2>
              <p>Hi ${firstName},</p>
              <p>Your worker account has been created successfully.</p>
              <p><strong>Login Details:</strong></p>
              <ul>
                <li>Email: ${email}</li>
                <li>Temporary Password: ${password}</li>
              </ul>
              <p>Please log in and change your password immediately.</p>
              <p>Best regards,<br/>The Premrest Team</p>
            </body>
          </html>
        `;

        await sendEmail(graphConfig, "clientservices@premrest.com.au", {
          subject: "Welcome to Premrest - Your Worker Account",
          body: welcomeEmailBody,
          to: [email],
        });

        console.log("✅ Welcome email sent via Microsoft Graph");
      }
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the entire operation if email fails
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
