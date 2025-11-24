import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeError } from "../_shared/errorHandler.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ReportIssueRequest {
  description: string;
  currentPage: string;
  currentPath: string;
  logs?: string;
  timestamp: string;
  userAgent: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Get reporter's profile
    const { data: reporterProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, tenant_id")
      .eq("id", user.id)
      .single();

    const {
      description,
      currentPage,
      currentPath,
      logs,
      timestamp,
      userAgent,
    } = await req.json() as ReportIssueRequest;

    // Get admin user ID (benjaminyoung8@gmail.com)
    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("email", "benjaminyoung8@gmail.com")
      .single();

    if (adminError || !adminProfile) {
      console.error("Admin user not found:", adminError);
      throw new Error("Admin user not found");
    }

    const reporterName = reporterProfile 
      ? `${reporterProfile.first_name || ''} ${reporterProfile.last_name || ''}`.trim() || reporterProfile.email
      : user.email;

    // Create task
    const taskTitle = `Issue Report: ${currentPath}`;
    const taskDescription = `**Issue Reported By:** ${reporterName} (${user.email})

**Description:**
${description}

**Context:**
- **Page:** ${currentPage}
- **Path:** ${currentPath}
- **Time:** ${new Date(timestamp).toLocaleString()}
- **User Agent:** ${userAgent}

**Logs:**
\`\`\`
${logs || 'No logs available'}
\`\`\``;

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        tenant_id: adminProfile.tenant_id,
        title: taskTitle,
        description: taskDescription,
        status: "pending",
        priority: "high",
        assigned_to: adminProfile.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (taskError) {
      console.error("Error creating task:", taskError);
      throw taskError;
    }

    // Send email notification
    const emailHtml = `
      <h2>New Issue Reported</h2>
      <p><strong>Reported by:</strong> ${reporterName} (${user.email})</p>
      <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
      
      <h3>Description:</h3>
      <p>${description.replace(/\n/g, '<br>')}</p>
      
      <h3>Context:</h3>
      <ul>
        <li><strong>Page:</strong> ${currentPage}</li>
        <li><strong>Path:</strong> ${currentPath}</li>
      </ul>
      
      <h3>Technical Details:</h3>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${logs || 'No logs available'}</pre>
      
      <p><strong>User Agent:</strong><br>${userAgent}</p>
      
      <hr>
      <p><small>Task #${task.id} created in the system</small></p>
    `;

    await resend.emails.send({
      from: "ServicePro Issues <jobs@premrest.com.au>",
      to: ["ben.young@premrest.com.au"],
      subject: `Issue Report: ${currentPath} - ${reporterName}`,
      html: emailHtml,
    });

    console.log("Issue reported successfully:", task.id);

    return new Response(
      JSON.stringify({ success: true, taskId: task.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in report-issue function:", error);
    return new Response(
      JSON.stringify({ error: sanitizeError(error, "report-issue") }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
