import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { abn } = await req.json();
    
    if (!abn) {
      throw new Error('ABN is required');
    }

    // Clean ABN - remove spaces and validate format
    const cleanABN = abn.replace(/\s/g, '');
    
    if (!/^\d{11}$/.test(cleanABN)) {
      throw new Error('ABN must be 11 digits');
    }

    const guid = Deno.env.get('ABR_GUID');
    if (!guid) {
      throw new Error('ABR_GUID not configured');
    }

    console.log('Validating ABN:', cleanABN);

    // Call ABR API
    const abrUrl = `https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/ABRSearchByABN?searchString=${cleanABN}&includeHistoricalDetails=N&authenticationGuid=${guid}`;
    
    const response = await fetch(abrUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml',
      },
    });

    if (!response.ok) {
      console.error('ABR API error:', response.status, response.statusText);
      throw new Error(`ABR API returned status ${response.status}`);
    }

    const xmlText = await response.text();
    console.log('ABR API Response received');

    // Parse XML response
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    if (!xmlDoc) {
      throw new Error('Failed to parse XML response');
    }

    // Check for errors
    const exception = xmlDoc.querySelector('exception');
    if (exception) {
      const exceptionDescription = exception.querySelector('exceptionDescription')?.textContent;
      throw new Error(exceptionDescription || 'ABR API returned an error');
    }

    // Extract business entity
    const businessEntity = xmlDoc.querySelector('businessEntity');
    if (!businessEntity) {
      throw new Error('No business entity found for this ABN');
    }

    // Check if ABN is current and active
    const recordLastUpdatedDate = businessEntity.querySelector('recordLastUpdatedDate')?.textContent;
    const abn_element = businessEntity.querySelector('ABN');
    const abn_status = abn_element?.getAttribute('status');
    
    if (abn_status !== 'Active') {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'This ABN is not currently active',
          status: abn_status 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract legal name (Main Name)
    const mainName = businessEntity.querySelector('mainName organisationName')?.textContent;
    
    // Extract trading names (Business Names)
    const businessNames: string[] = [];
    const businessNameElements = businessEntity.querySelectorAll('businessName organisationName');
    businessNameElements.forEach((element: any) => {
      const name = element.textContent;
      if (name && !businessNames.includes(name)) {
        businessNames.push(name);
      }
    });

    // Extract entity type
    const entityType = businessEntity.querySelector('entityType entityDescription')?.textContent;

    // Extract GST registration
    const gstElement = businessEntity.querySelector('goodsAndServicesTax');
    const gstRegistered = gstElement?.textContent === 'true';

    const result = {
      valid: true,
      abn: cleanABN,
      legalName: mainName || '',
      tradingNames: businessNames,
      entityType: entityType || '',
      gstRegistered,
      status: abn_status,
      lastUpdated: recordLastUpdatedDate,
    };

    console.log('ABN validation result:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in validate-abn function:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: error.message || 'Failed to validate ABN' 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
