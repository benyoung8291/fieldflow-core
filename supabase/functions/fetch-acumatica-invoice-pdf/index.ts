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

    const baseUrl = integration.acumatica_instance_url.replace(/\/$/, '');
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

    // Extract ALL session cookies properly using getSetCookie()
    const setCookieHeaders = loginResponse.headers.getSetCookie();
    const cookies = setCookieHeaders
      .map(cookie => cookie.split(';')[0]) // Get just the cookie name=value part
      .join('; ');
    
    console.log(`Acumatica login successful, got ${setCookieHeaders.length} cookies`);

    // Determine the report parameters based on invoice type
    // AR641000 = AR Invoice/Memo report
    // AP621500 = AP Bill report  
    const reportId = invoice_type === "ap" ? "AP621500" : "AR641000";
    const docType = invoice_type === "ap" ? "BIL" : "INV";

    // Try multiple report URL formats
    const reportUrls = [
      // Format 1: ReportScreen.aspx with format=pdf
      `${baseUrl}/ReportScreen.aspx?ReportID=${reportId}&DocType=${docType}&RefNbr=${encodeURIComponent(invoice.acumatica_reference_nbr)}&format=pdf`,
      // Format 2: Report page export
      `${baseUrl}/Report/ExportReport?reportId=${reportId}&format=pdf&DocType=${docType}&RefNbr=${encodeURIComponent(invoice.acumatica_reference_nbr)}`,
      // Format 3: Frames/ReportLauncher
      `${baseUrl}/Frames/ReportLauncher.aspx?ID=${reportId}&DocType=${docType}&RefNbr=${encodeURIComponent(invoice.acumatica_reference_nbr)}&_format=PDF`,
    ];

    let pdfBlob: Blob | null = null;
    let successUrl = "";

    for (const reportUrl of reportUrls) {
      console.log(`Trying report URL: ${reportUrl}`);
      try {
        const reportResponse = await fetch(reportUrl, {
          method: "GET",
          headers: {
            "Accept": "application/pdf, */*",
            "Cookie": cookies || "",
          },
          redirect: "follow",
        });

        console.log(`Response status: ${reportResponse.status}, content-type: ${reportResponse.headers.get('content-type')}`);

        if (reportResponse.ok) {
          const contentType = reportResponse.headers.get('content-type') || '';
          if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
            pdfBlob = await reportResponse.blob();
            successUrl = reportUrl;
            console.log(`Successfully fetched PDF from: ${reportUrl}`);
            break;
          } else {
            console.log(`Response was not a PDF (${contentType}), trying next URL...`);
          }
        } else {
          console.log(`Failed with status ${reportResponse.status}, trying next URL...`);
        }
      } catch (fetchError) {
        console.log(`Fetch error for ${reportUrl}:`, fetchError);
      }
    }

    if (!pdfBlob) {
      // Try one more approach: using the REST API to get the invoice directly as PDF
      console.log("Trying REST API file export...");
      const invoiceType = invoice_type === "ap" ? "Bill" : "Invoice";
      const fileUrl = `${baseUrl}/entity/Default/23.200.001/${invoiceType}/${invoice.acumatica_reference_nbr}/files`;
      
      try {
        const filesResponse = await fetch(fileUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cookie": cookies || "",
          },
        });
        
        if (filesResponse.ok) {
          const files = await filesResponse.json();
          console.log("Found files:", JSON.stringify(files));
          
          // Look for a PDF attachment
          if (Array.isArray(files) && files.length > 0) {
            for (const file of files) {
              if (file.filename?.toLowerCase().endsWith('.pdf')) {
                const fileDownloadUrl = `${baseUrl}/entity/Default/23.200.001/files/${file.id}`;
                const fileResponse = await fetch(fileDownloadUrl, {
                  method: "GET",
                  headers: {
                    "Accept": "application/pdf",
                    "Cookie": cookies || "",
                  },
                });
                
                if (fileResponse.ok) {
                  pdfBlob = await fileResponse.blob();
                  successUrl = fileDownloadUrl;
                  console.log("Successfully fetched PDF attachment");
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.log("File API approach failed:", e);
      }
    }

    // Logout from Acumatica
    try {
      await fetch(`${baseUrl}/entity/auth/logout`, {
        method: "POST",
        headers: { "Cookie": cookies || "" },
      });
      console.log("Logged out from Acumatica");
    } catch (e) {
      console.log("Logout error (non-critical):", e);
    }

    if (!pdfBlob) {
      throw new Error("Could not retrieve PDF from Acumatica. The invoice may not have a PDF available or the report format may not be supported.");
    }

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
