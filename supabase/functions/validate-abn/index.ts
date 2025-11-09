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

    // Call ABR API with includeHistoricalDetails=Y to get full details
    const abrUrl = `https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/ABRSearchByABN?searchString=${cleanABN}&includeHistoricalDetails=Y&authenticationGuid=${guid}`;
    
    console.log('Calling ABR API...');
    
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
    console.log('ABR API Response received, length:', xmlText.length);
    console.log('Response preview:', xmlText.substring(0, 500));

    // Check for errors using regex
    if (hasXMLTag(xmlText, 'exception')) {
      const exceptionDescription = extractXMLValue(xmlText, 'exceptionDescription');
      console.error('ABR API exception:', exceptionDescription);
      throw new Error(exceptionDescription || 'ABR API returned an error');
    }

    // Check if business entity exists
    if (!hasXMLTag(xmlText, 'businessEntity')) {
      console.error('No businessEntity tag found in response');
      throw new Error('No business entity found for this ABN');
    }

    // Extract ABN status from entityStatusCode
    const entityStatusMatch = xmlText.match(/<entityStatus[^>]*>([\s\S]*?)<\/entityStatus>/i);
    let abn_status = null;
    if (entityStatusMatch) {
      const entityStatusSection = entityStatusMatch[1];
      const statusCodeMatch = entityStatusSection.match(/<entityStatusCode>([^<]*)<\/entityStatusCode>/i);
      abn_status = statusCodeMatch ? statusCodeMatch[1].trim() : null;
    }
    
    console.log('ABN status:', abn_status);
    
    if (abn_status !== 'Active') {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `This ABN status is: ${abn_status || 'Unknown'}`,
          status: abn_status 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract legal name from mainName section
    const mainNameMatch = xmlText.match(/<mainName[^>]*>([\s\S]*?)<\/mainName>/i);
    let mainName = '';
    if (mainNameMatch) {
      const mainNameSection = mainNameMatch[1];
      mainName = extractXMLValue(mainNameSection, 'organisationName') || '';
    }
    console.log('Legal name (mainName):', mainName);
    
    // Extract all business names (trading names)
    const businessNames: string[] = [];
    const businessNameMatches = xmlText.matchAll(/<businessName[^>]*>([\s\S]*?)<\/businessName>/gi);
    
    for (const match of businessNameMatches) {
      const businessNameSection = match[1];
      const orgName = extractXMLValue(businessNameSection, 'organisationName');
      if (orgName && !businessNames.includes(orgName)) {
        businessNames.push(orgName);
      }
    }
    console.log('Business names (trading names):', businessNames);

    // Extract entity type
    const entityTypeMatch = xmlText.match(/<entityType[^>]*>([\s\S]*?)<\/entityType>/i);
    let entityType = '';
    if (entityTypeMatch) {
      const entityTypeSection = entityTypeMatch[1];
      entityType = extractXMLValue(entityTypeSection, 'entityDescription') || '';
    }
    console.log('Entity type:', entityType);

    // Extract GST registration - look for goodsAndServicesTax section
    const gstMatch = xmlText.match(/<goodsAndServicesTax[^>]*>([\s\S]*?)<\/goodsAndServicesTax>/i);
    let gstRegistered = false;
    if (gstMatch) {
      const gstSection = gstMatch[1];
      const gstFromDate = extractXMLValue(gstSection, 'effectiveFrom');
      const gstToDate = extractXMLValue(gstSection, 'effectiveTo');
      // GST is active if effectiveFrom exists and effectiveTo is either null, empty, or 0001-01-01
      gstRegistered = gstFromDate !== null && (!gstToDate || gstToDate === '0001-01-01');
      console.log('GST registered:', gstRegistered, 'effectiveFrom:', gstFromDate, 'effectiveTo:', gstToDate);
    }

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

    console.log('ABN validation result:', JSON.stringify(result, null, 2));

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
