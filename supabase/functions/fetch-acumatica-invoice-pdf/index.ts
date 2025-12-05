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
      .map(cookie => cookie.split(';')[0])
      .join('; ');
    
    console.log(`Acumatica login successful, got ${setCookieHeaders.length} cookies`);

    // Determine the report parameters based on invoice type
    const reportId = invoice_type === "ap" ? "AP621500" : "AR641000";
    const docType = invoice_type === "ap" ? "Bill" : "Invoice";

    let pdfBlob: Blob | null = null;

    // Method 1: Try REST API report print endpoint (Acumatica 2023 R1+)
    console.log("Trying REST API report print endpoint...");
    try {
      const printReportUrl = `${baseUrl}/entity/Default/23.200.001/report/${reportId}`;
      const reportParams = invoice_type === "ap" 
        ? { DocType: "BIL", RefNbr: invoice.acumatica_reference_nbr }
        : { DocType: "INV", RefNbr: invoice.acumatica_reference_nbr };
      
      const printResponse = await fetch(printReportUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/pdf",
          "Cookie": cookies,
        },
        body: JSON.stringify({
          parameters: reportParams,
          format: "PDF"
        }),
      });
      
      console.log(`Report print response: ${printResponse.status}, content-type: ${printResponse.headers.get('content-type')}`);
      
      if (printResponse.ok) {
        const contentType = printResponse.headers.get('content-type') || '';
        if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
          pdfBlob = await printResponse.blob();
          console.log("Successfully fetched PDF via report print endpoint");
        }
      }
    } catch (e) {
      console.log("Report print endpoint error:", e);
    }

    // Method 2: Try OData-style report export
    if (!pdfBlob) {
      console.log("Trying OData report export...");
      try {
        const odataReportUrl = `${baseUrl}/odata/${companyName}/${reportId}?$format=pdf&DocType=${invoice_type === "ap" ? "BIL" : "INV"}&RefNbr=${encodeURIComponent(invoice.acumatica_reference_nbr)}`;
        
        const odataResponse = await fetch(odataReportUrl, {
          method: "GET",
          headers: {
            "Accept": "application/pdf",
            "Cookie": cookies,
          },
        });
        
        console.log(`OData response: ${odataResponse.status}, content-type: ${odataResponse.headers.get('content-type')}`);
        
        if (odataResponse.ok) {
          const contentType = odataResponse.headers.get('content-type') || '';
          if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
            pdfBlob = await odataResponse.blob();
            console.log("Successfully fetched PDF via OData");
          }
        }
      } catch (e) {
        console.log("OData export error:", e);
      }
    }

    // Method 3: Get the invoice entity and check for attached files
    if (!pdfBlob) {
      console.log("Checking for attached files on the invoice...");
      try {
        const entityUrl = `${baseUrl}/entity/Default/23.200.001/${docType}/${encodeURIComponent(invoice.acumatica_reference_nbr)}?$expand=files`;
        
        const entityResponse = await fetch(entityUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Cookie": cookies,
          },
        });
        
        console.log(`Entity response: ${entityResponse.status}`);
        
        if (entityResponse.ok) {
          const entityData = await entityResponse.json();
          console.log(`Entity has ${entityData.files?.length || 0} attached files`);
          
          if (entityData.files && entityData.files.length > 0) {
            // Find PDF files
            for (const file of entityData.files) {
              const fileName = file.filename || file.name || '';
              console.log(`Found file: ${fileName}`);
              
              if (fileName.toLowerCase().endsWith('.pdf')) {
                const fileId = file.id || file.href;
                let fileUrl = '';
                
                if (file.href) {
                  fileUrl = file.href.startsWith('http') ? file.href : `${baseUrl}${file.href}`;
                } else if (fileId) {
                  fileUrl = `${baseUrl}/entity/Default/23.200.001/files/${fileId}`;
                }
                
                if (fileUrl) {
                  console.log(`Downloading file from: ${fileUrl}`);
                  const fileResponse = await fetch(fileUrl, {
                    method: "GET",
                    headers: {
                      "Accept": "application/pdf, application/octet-stream, */*",
                      "Cookie": cookies,
                    },
                  });
                  
                  console.log(`File download response: ${fileResponse.status}, content-type: ${fileResponse.headers.get('content-type')}`);
                  
                  if (fileResponse.ok) {
                    pdfBlob = await fileResponse.blob();
                    console.log(`Successfully downloaded attached PDF: ${fileName}`);
                    break;
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.log("Entity files check error:", e);
      }
    }

    // Method 4: Try screen-based API print action
    if (!pdfBlob) {
      console.log("Trying screen-based print action...");
      try {
        const screenId = invoice_type === "ap" ? "AP301000" : "AR301000";
        const actionUrl = `${baseUrl}/entity/Default/23.200.001/${docType}/${encodeURIComponent(invoice.acumatica_reference_nbr)}/print`;
        
        const printActionResponse = await fetch(actionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/pdf",
            "Cookie": cookies,
          },
          body: JSON.stringify({}),
        });
        
        console.log(`Print action response: ${printActionResponse.status}, content-type: ${printActionResponse.headers.get('content-type')}`);
        
        if (printActionResponse.ok) {
          const contentType = printActionResponse.headers.get('content-type') || '';
          if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
            pdfBlob = await printActionResponse.blob();
            console.log("Successfully fetched PDF via print action");
          }
        }
      } catch (e) {
        console.log("Print action error:", e);
      }
    }

    // Logout from Acumatica
    try {
      await fetch(`${baseUrl}/entity/auth/logout`, {
        method: "POST",
        headers: { "Cookie": cookies },
      });
      console.log("Logged out from Acumatica");
    } catch (e) {
      console.log("Logout error (non-critical):", e);
    }

    if (!pdfBlob) {
      throw new Error("Could not retrieve PDF from Acumatica. The invoice may not have a PDF attachment. Try printing the invoice in Acumatica first to generate a PDF attachment.");
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
