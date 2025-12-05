import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  invoice_id: string;
  invoice_type: "ar" | "ap";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoice_id, invoice_type = "ar" }: RequestBody = await req.json();
    console.log(`Fetching PDF for ${invoice_type.toUpperCase()} invoice: ${invoice_id}`);

    if (!invoice_id) {
      throw new Error("invoice_id is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get invoice details based on type
    const tableName = invoice_type === "ap" ? "ap_invoices" : "invoices";
    const { data: invoice, error: invoiceError } = await supabase
      .from(tableName)
      .select("id, tenant_id, invoice_number, acumatica_reference_nbr, acumatica_invoice_id")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      throw new Error("Invoice not found");
    }

    if (!invoice.acumatica_reference_nbr) {
      throw new Error("Invoice has not been synced to Acumatica yet");
    }

    console.log(`Found invoice ${invoice.invoice_number} with Acumatica ref: ${invoice.acumatica_reference_nbr}`);

    // Get Acumatica integration settings
    const { data: integration, error: integrationError } = await supabase
      .from("accounting_integrations")
      .select("id, acumatica_instance_url, acumatica_username, acumatica_company_name")
      .eq("tenant_id", invoice.tenant_id)
      .eq("provider", "myob_acumatica")
      .eq("is_enabled", true)
      .single();

    if (integrationError || !integration) {
      console.error("Acumatica integration not found:", integrationError);
      throw new Error("Acumatica integration not configured");
    }

    // Get decrypted password from vault
    const { data: passwordData, error: passwordError } = await supabase.rpc(
      "get_acumatica_password",
      { integration_id: integration.id }
    );

    if (passwordError) {
      console.error("Failed to get Acumatica password:", passwordError);
      throw new Error("Failed to retrieve Acumatica credentials");
    }

    const baseUrl = integration.acumatica_instance_url;
    const username = integration.acumatica_username;
    const password = passwordData;
    const companyName = integration.acumatica_company_name;

    // Login to Acumatica
    console.log("Logging into Acumatica...");
    const loginResponse = await fetch(`${baseUrl}/entity/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: username,
        password: password,
        company: companyName,
      }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error("Acumatica login failed:", errorText);
      throw new Error("Failed to authenticate with Acumatica");
    }

    // Extract session cookies
    const cookies = loginResponse.headers.get("set-cookie");
    console.log("Acumatica login successful");

    // Determine the report screen ID based on invoice type
    // AR641000 = AR Invoice/Memo
    // AP621500 = AP Bill
    const reportScreenId = invoice_type === "ap" ? "AP621500" : "AR641000";
    const docType = invoice_type === "ap" ? "BIL" : "INV";

    // Fetch the PDF report from Acumatica
    // Using the Report API endpoint
    const reportUrl = `${baseUrl}/entity/Default/23.200.001/Report/${reportScreenId}`;
    console.log(`Fetching PDF from: ${reportUrl}`);

    const reportResponse = await fetch(reportUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/pdf",
        Cookie: cookies || "",
      },
      body: JSON.stringify({
        DocType: { value: docType },
        RefNbr: { value: invoice.acumatica_reference_nbr },
      }),
    });

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text();
      console.error("Failed to fetch PDF report:", reportResponse.status, errorText);
      
      // Try alternative endpoint format
      console.log("Trying alternative report endpoint...");
      const altReportUrl = `${baseUrl}/Report/ExportReport?reportId=${reportScreenId}&format=pdf&DocType=${docType}&RefNbr=${invoice.acumatica_reference_nbr}`;
      
      const altReportResponse = await fetch(altReportUrl, {
        method: "GET",
        headers: {
          "Accept": "application/pdf",
          Cookie: cookies || "",
        },
      });

      if (!altReportResponse.ok) {
        const altErrorText = await altReportResponse.text();
        console.error("Alternative PDF fetch also failed:", altReportResponse.status, altErrorText);
        throw new Error(`Failed to fetch PDF from Acumatica: ${reportResponse.status}`);
      }

      // Use alternative response
      const pdfBlob = await altReportResponse.blob();
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfUint8Array = new Uint8Array(pdfArrayBuffer);

      // Upload to Supabase Storage
      const storagePath = `${invoice.tenant_id}/${invoice_type}/${invoice.id}.pdf`;
      console.log(`Uploading PDF to storage: ${storagePath}`);

      const { error: uploadError } = await supabase.storage
        .from("invoice-pdfs")
        .upload(storagePath, pdfUint8Array, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error("Failed to upload PDF to storage:", uploadError);
        throw new Error("Failed to store PDF");
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("invoice-pdfs")
        .getPublicUrl(storagePath);

      const pdfUrl = urlData.publicUrl;
      console.log(`PDF uploaded successfully: ${pdfUrl}`);

      // Update invoice record with PDF URL
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ pdf_url: pdfUrl })
        .eq("id", invoice_id);

      if (updateError) {
        console.error("Failed to update invoice with PDF URL:", updateError);
      }

      // Logout from Acumatica
      await fetch(`${baseUrl}/entity/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookies || "" },
      });

      return new Response(
        JSON.stringify({
          success: true,
          pdf_url: pdfUrl,
          message: "PDF fetched and stored successfully",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process successful response from primary endpoint
    const pdfBlob = await reportResponse.blob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();
    const pdfUint8Array = new Uint8Array(pdfArrayBuffer);

    // Upload to Supabase Storage
    const storagePath = `${invoice.tenant_id}/${invoice_type}/${invoice.id}.pdf`;
    console.log(`Uploading PDF to storage: ${storagePath}`);

    const { error: uploadError } = await supabase.storage
      .from("invoice-pdfs")
      .upload(storagePath, pdfUint8Array, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload PDF to storage:", uploadError);
      throw new Error("Failed to store PDF");
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("invoice-pdfs")
      .getPublicUrl(storagePath);

    const pdfUrl = urlData.publicUrl;
    console.log(`PDF uploaded successfully: ${pdfUrl}`);

    // Update invoice record with PDF URL
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ pdf_url: pdfUrl })
      .eq("id", invoice_id);

    if (updateError) {
      console.error("Failed to update invoice with PDF URL:", updateError);
    }

    // Logout from Acumatica
    await fetch(`${baseUrl}/entity/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookies || "" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: pdfUrl,
        message: "PDF fetched and stored successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in fetch-acumatica-invoice-pdf:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
