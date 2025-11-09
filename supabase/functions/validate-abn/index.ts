import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract text between XML tags
const extractXMLValue = (xml: string, tag: string): string | null => {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
};

// Helper function to extract all matching XML values
const extractAllXMLValues = (xml: string, tag: string): string[] => {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
  const matches = xml.matchAll(regex);
  const values: string[] = [];
  for (const match of matches) {
    if (match[1].trim()) {
      values.push(match[1].trim());
    }
  }
  return values;
};

// Helper function to check if XML contains a tag
const hasXMLTag = (xml: string, tag: string): boolean => {
  const regex = new RegExp(`<${tag}[^>]*>`, 'i');
  return regex.test(xml);
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

    // Check for errors using regex
    if (hasXMLTag(xmlText, 'exception')) {
      const exceptionDescription = extractXMLValue(xmlText, 'exceptionDescription');
      throw new Error(exceptionDescription || 'ABR API returned an error');
    }

    // Check if business entity exists
    if (!hasXMLTag(xmlText, 'businessEntity')) {
      throw new Error('No business entity found for this ABN');
    }

    // Extract ABN status from the ABN tag attribute
    const abnStatusMatch = xmlText.match(/<ABN[^>]*status="([^"]*)"[^>]*>/i);
    const abn_status = abnStatusMatch ? abnStatusMatch[1] : null;
    
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
    const mainName = extractXMLValue(xmlText, 'organisationName');
    
    // Extract all trading names (Business Names)
    // First, extract the businessName section
    const businessNameSectionMatch = xmlText.match(/<businessName[^>]*>[\s\S]*?<\/businessName>/gi);
    const businessNames: string[] = [];
    
    if (businessNameSectionMatch) {
      businessNameSectionMatch.forEach((section) => {
        const orgName = extractXMLValue(section, 'organisationName');
        if (orgName && !businessNames.includes(orgName)) {
          businessNames.push(orgName);
        }
      });
    }

    // Extract entity type
    const entityType = extractXMLValue(xmlText, 'entityDescription');

    // Extract GST registration
    const gstValue = extractXMLValue(xmlText, 'goodsAndServicesTax');
    const gstRegistered = gstValue === 'true';

    // Extract last updated date
    const recordLastUpdatedDate = extractXMLValue(xmlText, 'recordLastUpdatedDate');

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
