import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { triggerType, triggerData } = await req.json();

    console.log("Workflow trigger received:", triggerType);

    // Get user's tenant
    const authHeader = req.headers.get("Authorization");
    let tenantId = triggerData.tenantId;

    if (!tenantId && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      
      if (user) {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        
        tenantId = profile?.tenant_id;
      }
    }

    if (!tenantId) {
      throw new Error("Unable to determine tenant ID");
    }

    // Find active workflows matching this trigger
    const { data: workflows, error: workflowError } = await supabaseClient
      .from("workflows")
      .select("id, name, trigger_type")
      .eq("tenant_id", tenantId)
      .eq("trigger_type", triggerType)
      .eq("is_active", true);

    if (workflowError) {
      throw new Error(`Failed to fetch workflows: ${workflowError.message}`);
    }

    if (!workflows || workflows.length === 0) {
      console.log("No active workflows found for trigger:", triggerType);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No workflows to execute",
          triggeredCount: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger each matching workflow
    const executionPromises = workflows.map(async (workflow) => {
      try {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-workflow`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              workflowId: workflow.id,
              triggerData: {
                ...triggerData,
                triggerType,
                triggeredAt: new Date().toISOString(),
              },
              tenantId,
            }),
          }
        );

        const result = await response.json();
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: response.ok,
          executionId: result.executionId,
        };
      } catch (error) {
        console.error(`Failed to trigger workflow ${workflow.id}:`, error);
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const results = await Promise.all(executionPromises);

    return new Response(
      JSON.stringify({
        success: true,
        triggeredCount: results.filter(r => r.success).length,
        totalWorkflows: workflows.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Trigger workflow error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
