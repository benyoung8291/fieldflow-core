import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Initialize Supabase client for cache access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const { data: cached } = await supabase
      .from('abn_validation_cache')
      .select('*')
      .eq('abn', cleanABN)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      console.log('ABN cache hit:', cleanABN);
      return new Response(JSON.stringify({
        valid: cached.valid,
        legalName: cached.legal_name,
        tradingNames: cached.trading_names || [],
        entityType: cached.entity_type,
        gstRegistered: cached.gst_registered,
        status: cached.status,
        lastUpdated: cached.last_updated,
        fromCache: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('ABN cache miss, calling API:', cleanABN);

    const guid = Deno.env.get('ABR_GUID');
    if (!guid) {
      throw new Error('ABR_GUID not configured');
    }

    // Call ABR API with includeHistoricalDetails=Y to get full details
    const abrUrl = `https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/ABRSearchByABN?searchString=${cleanABN}&includeHistoricalDetails=Y&authenticationGuid=${guid}`;
    
    const response = await fetch(abrUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`ABR API returned status ${response.status}`);
    }

    const xmlText = await response.text();

    // Check for errors using regex
    if (hasXMLTag(xmlText, 'exception')) {
      const exceptionDescription = extractXMLValue(xmlText, 'exceptionDescription');
      throw new Error(exceptionDescription || 'ABR API returned an error');
    }

    // Extract the entire response section after <response> tag
    const responseMatch = xmlText.match(/<response>([\s\S]+)<\/response>/i);
    if (!responseMatch) {
      throw new Error('Invalid ABR API response format');
    }
    
    const responseSection = responseMatch[1];
    
    // Now extract businessEntity from the response section
    const businessEntityTag = responseSection.match(/<businessEntity[^>]*>([\s\S]+)<\/businessEntity[^>]*>/i);
    
    if (!businessEntityTag) {
      throw new Error('No business entity found for this ABN');
    }
    
    const businessEntitySection = businessEntityTag[1];
    
    // Log the first 500 chars of businessEntity section to debug
    console.log('DEBUG: businessEntitySection (first 500 chars):', businessEntitySection.substring(0, 500));
    
    // Check if businessName tags exist
    const businessNameCount = (businessEntitySection.match(/<businessName>/g) || []).length;

    // Extract ABN status from entityStatusCode - search within businessEntity section
    const entityStatusMatch = businessEntitySection.match(/<entityStatus[^>]*>([\s\S]*?)<\/entityStatus>/i);
    let abn_status = null;
    if (entityStatusMatch) {
      const entityStatusSection = entityStatusMatch[1];
      const statusCodeMatch = entityStatusSection.match(/<entityStatusCode>([^<]*)<\/entityStatusCode>/i);
      abn_status = statusCodeMatch ? statusCodeMatch[1].trim() : null;
    }
    
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

    // Extract legal name from mainName section within businessEntity
    const mainNameMatch = businessEntitySection.match(/<mainName[^>]*>([\s\S]*?)<\/mainName>/i);
    let mainName = '';
    
    console.log('DEBUG: mainNameMatch found:', mainNameMatch ? 'yes' : 'no');
    
    if (mainNameMatch) {
      const mainNameSection = mainNameMatch[1];
      console.log('DEBUG: mainNameSection:', mainNameSection.substring(0, 200));
      
      // Try organisation name first (for companies)
      mainName = extractXMLValue(mainNameSection, 'organisationName') || '';
      console.log('DEBUG: organisationName:', mainName);
      
      // If no organisation name, try person name (for sole traders)
      if (!mainName) {
        const givenName = extractXMLValue(mainNameSection, 'givenName') || '';
        const familyName = extractXMLValue(mainNameSection, 'familyName') || '';
        const otherGivenName = extractXMLValue(mainNameSection, 'otherGivenName') || '';
        
        console.log('DEBUG: Sole trader names - given:', givenName, 'family:', familyName, 'other:', otherGivenName);
        
        if (familyName) {
          mainName = [givenName, otherGivenName, familyName]
            .filter(Boolean)
            .join(' ')
            .trim();
          console.log('DEBUG: Constructed mainName for sole trader:', mainName);
        }
      }
    }
    
    console.log('DEBUG: Final mainName:', mainName);
    
    // Extract all business names (trading names) from businessEntity section
    const businessNames: string[] = [];
    const businessNameMatches = businessEntitySection.matchAll(/<businessName[^>]*>([\s\S]*?)<\/businessName>/gi);
    
    for (const match of businessNameMatches) {
      const businessNameSection = match[1];
      const orgName = extractXMLValue(businessNameSection, 'organisationName');
      if (orgName && !businessNames.includes(orgName)) {
        businessNames.push(orgName);
      }
    }

    // Extract entity type from businessEntity section
    const entityTypeMatch = businessEntitySection.match(/<entityType[^>]*>([\s\S]*?)<\/entityType>/i);
    let entityType = '';
    if (entityTypeMatch) {
      const entityTypeSection = entityTypeMatch[1];
      entityType = extractXMLValue(entityTypeSection, 'entityDescription') || '';
    }

    // Extract GST registration from businessEntity section
    const gstMatch = businessEntitySection.match(/<goodsAndServicesTax[^>]*>([\s\S]*?)<\/goodsAndServicesTax>/i);
    let gstRegistered = false;
    if (gstMatch) {
      const gstSection = gstMatch[1];
      const gstFromDate = extractXMLValue(gstSection, 'effectiveFrom');
      const gstToDate = extractXMLValue(gstSection, 'effectiveTo');
      // GST is active if effectiveFrom exists and effectiveTo is either null, empty, or 0001-01-01
      gstRegistered = gstFromDate !== null && (!gstToDate || gstToDate === '0001-01-01');
    }

    // Extract last updated date from businessEntity section
    const recordLastUpdatedDate = extractXMLValue(businessEntitySection, 'recordLastUpdatedDate');

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

    // Cache the result for future lookups (non-blocking)
    supabase
      .from('abn_validation_cache')
      .upsert({
        abn: cleanABN,
        valid: true,
        legal_name: mainName || '',
        trading_names: businessNames,
        entity_type: entityType || '',
        gst_registered: gstRegistered,
        status: abn_status,
        last_updated: recordLastUpdatedDate,
      })
      .then(() => console.log('ABN cached'));

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
