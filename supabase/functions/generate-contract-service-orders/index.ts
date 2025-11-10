import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContractLineItem {
  id: string;
  contract_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  recurrence_frequency: string;
  next_generation_date: string;
  first_generation_date: string;
  service_contracts: {
    id: string;
    contract_number: string;
    title: string;
    customer_id: string;
    tenant_id: string;
    customers: {
      name: string;
    };
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

    console.log("Starting automated service order generation...");

    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    console.log(`Checking for line items with generation date: ${todayStr}`);

    // Fetch active contract line items that need generation today
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("service_contract_line_items")
      .select(`
        *,
        service_contracts!inner (
          id,
          contract_number,
          title,
          customer_id,
          tenant_id,
          status,
          auto_generate,
          customers (name)
        ),
        customer_locations (
          id,
          name,
          address,
          city,
          state,
          postcode
        )
      `)
      .eq("is_active", true)
      .eq("next_generation_date", todayStr)
      .eq("service_contracts.status", "active")
      .eq("service_contracts.auto_generate", true);

    if (lineItemsError) {
      console.error("Error fetching line items:", lineItemsError);
      throw lineItemsError;
    }

    console.log(`Found ${lineItems?.length || 0} line items to process`);

    if (!lineItems || lineItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No service orders to generate today" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group line items by contract_id
    const groupedByContract = lineItems.reduce((acc: any, item: any) => {
      const contractId = item.contract_id;
      if (!acc[contractId]) {
        acc[contractId] = {
          contract: item.service_contracts,
          items: [],
        };
      }
      acc[contractId].items.push(item);
      return acc;
    }, {});

    console.log(`Grouped into ${Object.keys(groupedByContract).length} contracts`);

    const createdOrders: any[] = [];
    const errors: any[] = [];

    // Create service orders for each contract
    for (const [contractId, data] of Object.entries(groupedByContract) as any) {
      try {
        const { contract, items } = data;
        
        console.log(`Processing contract ${contract.contract_number} with ${items.length} items`);

        // Generate service order number
        const { data: latestOrder } = await supabase
          .from("service_orders")
          .select("order_number")
          .eq("tenant_id", contract.tenant_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastNumber = latestOrder?.order_number?.match(/\d+$/)?.[0] || "0";
        const newOrderNumber = `SO-${String(parseInt(lastNumber) + 1).padStart(5, "0")}`;

        // Calculate total estimated hours and fixed amount
        const estimatedHours = items.reduce((sum: number, item: any) => {
          // Assuming quantity represents hours for service items
          return sum + parseFloat(item.quantity);
        }, 0);

        const fixedAmount = items.reduce((sum: number, item: any) => {
          return sum + parseFloat(item.line_total);
        }, 0);

        // Create service order title from line items
        const title = items.length === 1
          ? items[0].description
          : `${contract.title} - Service Order`;

        const description = items.map((item: any) => 
          `${item.description} (Qty: ${item.quantity})`
        ).join("\n");

        // Get location from first line item (all items in group should have same location)
        const locationId = items[0].location_id || null;
        
        // Create the service order
        const { data: newOrder, error: orderError } = await supabase
          .from("service_orders")
          .insert({
            tenant_id: contract.tenant_id,
            customer_id: contract.customer_id,
            contract_id: contractId,
            order_number: newOrderNumber,
            title,
            description,
            status: "draft",
            billing_type: "fixed",
            fixed_amount: fixedAmount,
            estimated_hours: estimatedHours,
            priority: "normal",
            location_id: locationId,
            notes: `Auto-generated from contract ${contract.contract_number}`,
          })
          .select()
          .single();

        if (orderError) {
          console.error(`Error creating service order for contract ${contract.contract_number}:`, orderError);
          errors.push({
            contract: contract.contract_number,
            error: orderError.message,
          });
          continue;
        }

        console.log(`Created service order ${newOrderNumber} for contract ${contract.contract_number}`);

        // Update next_generation_date for each line item
        for (const item of items) {
          const nextDate = calculateNextGenerationDate(
            item.next_generation_date,
            item.recurrence_frequency
          );

          const { error: updateError } = await supabase
            .from("service_contract_line_items")
            .update({
              next_generation_date: nextDate,
              last_generated_date: todayStr,
            })
            .eq("id", item.id);

          if (updateError) {
            console.error(`Error updating line item ${item.id}:`, updateError);
          } else {
            console.log(`Updated line item ${item.id} - next generation: ${nextDate}`);
          }
        }

        createdOrders.push({
          orderNumber: newOrderNumber,
          contract: contract.contract_number,
          customer: contract.customers.name,
          itemCount: items.length,
          amount: fixedAmount,
        });
      } catch (error: any) {
        console.error(`Error processing contract ${contractId}:`, error);
        errors.push({
          contractId,
          error: error.message,
        });
      }
    }

    console.log(`Generation complete: ${createdOrders.length} orders created, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        message: "Service order generation completed",
        summary: {
          total_line_items: lineItems.length,
          contracts_processed: Object.keys(groupedByContract).length,
          orders_created: createdOrders.length,
          errors: errors.length,
        },
        created_orders: createdOrders,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-contract-service-orders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper function to calculate next generation date based on frequency
function calculateNextGenerationDate(currentDate: string, frequency: string): string | null {
  const date = new Date(currentDate);

  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "fortnightly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    case "one_time":
      // For one-time items, set to null so they don't generate again
      return null;
    default:
      console.warn(`Unknown frequency: ${frequency}`);
      return null;
  }

  return date.toISOString().split("T")[0];
}
