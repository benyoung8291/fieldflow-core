import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = new Date().toISOString().split("T")[0];

    // Find all active recurring invoices that need to be generated today
    const { data: recurringInvoices, error: fetchError } = await supabaseClient
      .from("recurring_invoices")
      .select(`
        *,
        recurring_invoice_line_items (*)
      `)
      .eq("is_active", true)
      .lte("next_invoice_date", today);

    if (fetchError) throw fetchError;

    const results = [];

    for (const recurring of recurringInvoices || []) {
      try {
        // Check if end date has passed
        if (recurring.end_date && recurring.end_date < today) {
          await supabaseClient
            .from("recurring_invoices")
            .update({ is_active: false })
            .eq("id", recurring.id);
          continue;
        }

        // Get the next invoice number
        const { data: lastInvoice } = await supabaseClient
          .from("invoices")
          .select("invoice_number")
          .eq("tenant_id", recurring.tenant_id)
          .like("invoice_number", `${recurring.invoice_number_prefix}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        let nextNumber = 1;
        if (lastInvoice) {
          const match = lastInvoice.invoice_number.match(/\d+$/);
          if (match) {
            nextNumber = parseInt(match[0]) + 1;
          }
        }

        const invoiceNumber = `${recurring.invoice_number_prefix}${String(nextNumber).padStart(4, "0")}`;
        const invoiceDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (recurring.payment_terms || 30));

        // Create the invoice
        const { data: newInvoice, error: invoiceError } = await supabaseClient
          .from("invoices")
          .insert({
            tenant_id: recurring.tenant_id,
            customer_id: recurring.customer_id,
            recurring_invoice_id: recurring.id,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate.toISOString().split("T")[0],
            due_date: dueDate.toISOString().split("T")[0],
            subtotal: recurring.subtotal,
            tax_rate: recurring.tax_rate,
            tax_amount: recurring.tax_amount,
            total_amount: recurring.total_amount,
            status: "draft",
            notes: recurring.notes,
            created_by: recurring.created_by,
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Create line items
        const lineItems = recurring.recurring_invoice_line_items.map((item: any) => ({
          invoice_id: newInvoice.id,
          tenant_id: recurring.tenant_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          item_order: item.item_order,
        }));

        const { error: lineItemsError } = await supabaseClient
          .from("invoice_line_items")
          .insert(lineItems);

        if (lineItemsError) throw lineItemsError;

        // Calculate next invoice date
        const nextDate = new Date(recurring.next_invoice_date);
        switch (recurring.frequency) {
          case "daily":
            nextDate.setDate(nextDate.getDate() + recurring.interval_count);
            break;
          case "weekly":
            nextDate.setDate(nextDate.getDate() + (7 * recurring.interval_count));
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + recurring.interval_count);
            break;
          case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + recurring.interval_count);
            break;
        }

        // Update recurring invoice with next date
        await supabaseClient
          .from("recurring_invoices")
          .update({ next_invoice_date: nextDate.toISOString().split("T")[0] })
          .eq("id", recurring.id);

        results.push({
          recurringInvoiceId: recurring.id,
          invoiceNumber: invoiceNumber,
          success: true,
        });
      } catch (error) {
        console.error(`Error generating invoice for ${recurring.id}:`, error);
        results.push({
          recurringInvoiceId: recurring.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in generate-recurring-invoices:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
