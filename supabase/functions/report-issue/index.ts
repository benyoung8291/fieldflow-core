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

    // Get all super_admin users for this tenant
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
    }

    console.log("Admin roles found:", adminRoles?.length || 0);
    const adminUserIds = adminRoles?.map(r => r.user_id) || [];
    console.log("Admin user IDs:", adminUserIds);

    const { data: adminUsersRaw, error: adminError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, tenant_id")
      .in("id", adminUserIds)
      .eq("tenant_id", reporterProfile?.tenant_id);

    if (adminError) {
      console.error("Error fetching admin users:", adminError);
    }

    const adminUsers = (adminUsersRaw || []).map(profile => ({
      user_id: profile.id,
      profiles: profile
    }));

    console.log("Admin users found:", adminUsers.length);

    const reporterName = reporterProfile 
      ? `${reporterProfile.first_name || ''} ${reporterProfile.last_name || ''}`.trim() || reporterProfile.email
      : user.email;

    // Prepare comprehensive issue report
    const issueReport = {
      reportedBy: reporterName,
      reporterEmail: user.email,
      description,
      currentPage,
      currentPath,
      timestamp: new Date(timestamp).toISOString(),
      userAgent,
      logs: logs || 'No logs captured',
      tenantId: reporterProfile?.tenant_id,
    };

    // Create task for each admin
    if (adminUsers && adminUsers.length > 0) {
      for (const admin of adminUsers) {
        const taskTitle = `🐛 Issue Report: ${currentPath}`;
        const taskDescription = `**Reported By:** ${reporterName} (${user.email})

**Description:**
${description}

**Context:**
- **Current Page:** ${currentPage}
- **Path:** ${currentPath}
- **Timestamp:** ${new Date(timestamp).toLocaleString()}
- **User Agent:** ${userAgent}

**Console Logs:**
\`\`\`
${logs || 'No logs available'}
\`\`\`

---
**Task Link:** [View in System](/tasks)`;

        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            tenant_id: admin.profiles.tenant_id,
            title: taskTitle,
            description: taskDescription,
            status: "pending",
            priority: "high",
            assigned_to: admin.user_id,
            created_by: user.id,
            linked_module: "bug_report",
          })
          .select()
          .single();

        if (taskError) {
          console.error("Error creating task for admin:", admin.user_id, taskError);
        } else {
          console.log("Task created successfully for admin:", admin.user_id, "Task ID:", task?.id);
        }

        // Create notification for admin
        try {
          const { data: notifData, error: notifError } = await supabase.rpc("create_notification", {
            p_user_id: admin.user_id,
            p_type: "bug_report",
            p_title: "New Bug Report",
            p_message: `${reporterName} reported: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
            p_link: `/tasks`,
            p_metadata: { taskId: task?.id, reportPath: currentPath },
          });
          
          if (notifError) {
            console.error("Error creating notification:", notifError);
          } else {
            console.log("Notification created successfully for admin:", admin.user_id);
          }
        } catch (notifError) {
          console.error("Error creating notification (catch):", notifError);
        }
      }
    }

    // Prepare detailed email for ben.young@premrest.com.au
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .section { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #1f2937; }
    .info-item { margin: 8px 0; padding: 8px; background: #f3f4f6; border-radius: 4px; }
    .info-label { font-weight: 600; color: #4b5563; }
    .code-block { background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 13px; }
    .lovable-prompt { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-top: 20px; border-radius: 4px; }
    .lovable-prompt-title { font-weight: 600; color: #1e40af; margin-bottom: 8px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">🐛 New Bug Report</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">ServicePro Issue Tracking System</p>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">📋 Issue Description</div>
        <p style="font-size: 16px; line-height: 1.8;">${description.replace(/\n/g, '<br>')}</p>
      </div>

      <div class="section">
        <div class="section-title">👤 Reporter Information</div>
        <div class="info-item">
          <span class="info-label">Name:</span> ${reporterName}
        </div>
        <div class="info-item">
          <span class="info-label">Email:</span> ${user.email}
        </div>
        <div class="info-item">
          <span class="info-label">Tenant ID:</span> ${reporterProfile?.tenant_id || 'Unknown'}
        </div>
      </div>

      <div class="section">
        <div class="section-title">🌐 Environment Details</div>
        <div class="info-item">
          <span class="info-label">URL:</span> <a href="${currentPage}" target="_blank">${currentPage}</a>
        </div>
        <div class="info-item">
          <span class="info-label">Route Path:</span> <code>${currentPath}</code>
        </div>
        <div class="info-item">
          <span class="info-label">Timestamp:</span> ${new Date(timestamp).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEDT
        </div>
        <div class="info-item">
          <span class="info-label">Browser:</span> ${userAgent}
        </div>
      </div>

      <div class="section">
        <div class="section-title">📊 Console Logs</div>
        <div class="code-block">${logs || 'No console logs captured'}</div>
      </div>

      <div class="lovable-prompt">
        <div class="lovable-prompt-title">💡 Suggested Lovable AI Prompt:</div>
        <div style="background: white; padding: 12px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 13px;">
I'm experiencing the following issue in my application:<br><br>
<strong>Issue:</strong> ${description.replace(/\n/g, '<br>')}<br><br>
<strong>Location:</strong> ${currentPath}<br>
<strong>Page URL:</strong> ${currentPage}<br><br>
<strong>Console Output:</strong><br>
<code>${logs || 'No logs available'}</code><br><br>
Please investigate the issue and provide a fix. Focus on:<br>
1. Identifying the root cause<br>
2. Implementing a proper solution<br>
3. Preventing similar issues in the future
        </div>
      </div>

      <div class="section">
        <div class="section-title">🔗 Quick Actions</div>
        <p style="margin: 0;">
          <a href="${currentPage}" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">View Page</a>
          <a href="https://lovable.dev" style="display: inline-block; padding: 10px 20px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px;">Open in Lovable</a>
        </p>
      </div>
    </div>

    <div class="footer">
      <p>This is an automated bug report from ServicePro</p>
      <p style="margin-top: 10px;">Reported at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
    </div>
  </div>
</body>
</html>`;

    // Send email to ben.young@premrest.com.au
    try {
      await resend.emails.send({
        from: "ServicePro Bug Reports <jobs@premrest.com.au>",
        to: ["ben.young@premrest.com.au"],
        subject: `🐛 Bug Report: ${currentPath} | ${reporterName}`,
        html: emailHtml,
      });
      console.log("Email sent to ben.young@premrest.com.au");
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Issue reported successfully. Admin users have been notified.",
        notificationsCreated: adminUsers?.length || 0,
      }),
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
