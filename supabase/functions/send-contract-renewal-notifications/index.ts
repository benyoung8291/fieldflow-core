import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface Contract {
  id: string;
  contract_number: string;
  title: string;
  end_date: string;
  total_contract_value: number;
  customers: {
    name: string;
    email: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user and verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has tenant_admin role
    const { data: adminRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'tenant_admin')
      .single();

    if (roleError || !adminRole) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated admin user: ${user.id}`);

    console.log("Starting contract renewal notification check...");

    // Get tenant settings for notification email
    const { data: settings, error: settingsError } = await supabase
      .from("tenant_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError) {
      console.error("Error fetching tenant settings:", settingsError);
      throw new Error("Failed to fetch tenant settings");
    }

    const notificationEmail = settings?.renewal_notification_email;
    if (!notificationEmail) {
      console.log("No notification email configured in settings");
      return new Response(
        JSON.stringify({ message: "No notification email configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate dates for 30, 60, and 90 days from now
    const today = new Date();
    const days30 = new Date(today);
    days30.setDate(today.getDate() + 30);
    const days60 = new Date(today);
    days60.setDate(today.getDate() + 60);
    const days90 = new Date(today);
    days90.setDate(today.getDate() + 90);

    // Format dates for SQL comparison (YYYY-MM-DD)
    const format30 = days30.toISOString().split("T")[0];
    const format60 = days60.toISOString().split("T")[0];
    const format90 = days90.toISOString().split("T")[0];

    console.log("Checking for contracts expiring on:", { format30, format60, format90 });

    // Get contracts expiring in 30, 60, or 90 days
    const { data: contracts, error: contractsError } = await supabase
      .from("service_contracts")
      .select(`
        id,
        contract_number,
        title,
        end_date,
        total_contract_value,
        customers (name, email)
      `)
      .eq("status", "active")
      .not("end_date", "is", null)
      .in("end_date", [format30, format60, format90]);

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      throw contractsError;
    }

    console.log(`Found ${contracts?.length || 0} contracts expiring soon`);

    if (!contracts || contracts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No contracts expiring soon" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send renewal notifications
    const emailPromises = contracts.map(async (contract: any) => {
      const endDate = new Date(contract.end_date);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Sending notification for contract ${contract.contract_number} - ${daysUntilExpiry} days until expiry`);

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            Contract Renewal Reminder
          </h1>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #007bff; margin-top: 0;">⚠️ Contract Expiring in ${daysUntilExpiry} Days</h2>
            <p style="color: #666; line-height: 1.6;">
              This is a ${daysUntilExpiry}-day advance notice that the following service contract is approaching its end date.
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Contract Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Contract Number:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${contract.contract_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Title:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${contract.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Customer:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${contract.customers.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Customer Email:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${contract.customers.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Contract Value:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${Number(contract.total_contract_value).toFixed(2)} (Ex-GST)</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">End Date:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #dc3545; font-weight: bold;">
                  ${new Date(contract.end_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </td>
              </tr>
            </table>
          </div>

          <div style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
            <h4 style="color: #007bff; margin-top: 0;">Action Required</h4>
            <p style="color: #666; line-height: 1.6; margin-bottom: 0;">
              Please review this contract and take appropriate action:
            </p>
            <ul style="color: #666; line-height: 1.6;">
              <li>Contact the customer to discuss renewal</li>
              <li>Review and update contract terms and pricing</li>
              <li>Prepare a new contract or extension</li>
              <li>Update the contract status in the system</li>
            </ul>
          </div>

          <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 5px; text-align: center;">
            <p style="color: #666; margin: 0;">
              <a href="${supabaseUrl.replace('https://', 'https://').replace('.supabase.co', '')}/service-contracts/${contract.id}" 
                 style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Contract in System
              </a>
            </p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
            <p>This is an automated notification from your Service Contract Management System.</p>
            <p>Do not reply to this email. If you have questions, please contact your system administrator.</p>
          </div>
        </div>
      `;

      try {
        const emailResult = await resend.emails.send({
          from: "FieldFlow <onboarding@resend.dev>",
          to: [notificationEmail],
          subject: `Contract Renewal Alert: ${contract.contract_number} - Expiring in ${daysUntilExpiry} Days`,
          html: emailHtml,
        });

        console.log(`Email sent successfully for contract ${contract.contract_number}:`, emailResult);
        return { success: true, contract: contract.contract_number, emailResult };
      } catch (emailError) {
        console.error(`Failed to send email for contract ${contract.contract_number}:`, emailError);
        return { success: false, contract: contract.contract_number, error: emailError };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`Notification summary: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        message: "Contract renewal notifications processed",
        total: contracts.length,
        sent: successCount,
        failed: failureCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contract-renewal-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
