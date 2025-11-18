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
    const { locationIds } = await req.json();
    
    if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      throw new Error("Location IDs array is required");
    }

    const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error("GOOGLE_PLACES_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header to verify tenant
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Unable to get tenant information");
    }

    // Fetch locations to geocode
    const { data: locations, error: fetchError } = await supabase
      .from("customer_locations")
      .select("id, address, city, state, postcode")
      .eq("tenant_id", profile.tenant_id)
      .in("id", locationIds)
      .is("latitude", null); // Only geocode locations without coordinates

    if (fetchError) {
      throw new Error(`Failed to fetch locations: ${fetchError.message}`);
    }

    if (!locations || locations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, geocoded: 0, failed: 0, message: "No locations to geocode" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Geocoding ${locations.length} locations...`);
    
    const geocodedAddresses = new Map();
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const location of locations) {
      const addressKey = `${location.address}, ${location.city || ''}, ${location.state || ''}, ${location.postcode || ''}`.trim();
      
      // Skip if already geocoded in this batch
      if (geocodedAddresses.has(addressKey)) {
        const cachedData = geocodedAddresses.get(addressKey);
        if (cachedData.success) {
          await supabase
            .from("customer_locations")
            .update({
              latitude: cachedData.latitude,
              longitude: cachedData.longitude,
              formatted_address: cachedData.formatted_address
            })
            .eq("id", location.id);
          successCount++;
        } else {
          failCount++;
        }
        continue;
      }

      try {
        const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
        geocodeUrl.searchParams.append("address", addressKey);
        geocodeUrl.searchParams.append("components", "country:AU");
        geocodeUrl.searchParams.append("key", GOOGLE_PLACES_API_KEY);
        
        const geocodeResponse = await fetch(geocodeUrl.toString());
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status === "OK" && geocodeData.results && geocodeData.results.length > 0) {
          const result = geocodeData.results[0];
          const geoLocation = result.geometry.location;
          
          const enrichedData = {
            success: true,
            latitude: geoLocation.lat,
            longitude: geoLocation.lng,
            formatted_address: result.formatted_address
          };
          
          geocodedAddresses.set(addressKey, enrichedData);
          
          // Update location in database
          const { error: updateError } = await supabase
            .from("customer_locations")
            .update({
              latitude: enrichedData.latitude,
              longitude: enrichedData.longitude,
              formatted_address: enrichedData.formatted_address
            })
            .eq("id", location.id);

          if (updateError) {
            console.error(`Failed to update location ${location.id}:`, updateError);
            results.push({
              locationId: location.id,
              success: false,
              error: updateError.message
            });
            failCount++;
          } else {
            console.log(`Geocoded: ${addressKey} -> lat: ${geoLocation.lat}, lng: ${geoLocation.lng}`);
            results.push({
              locationId: location.id,
              success: true,
              latitude: geoLocation.lat,
              longitude: geoLocation.lng,
              formatted_address: result.formatted_address
            });
            successCount++;
          }
        } else {
          console.warn(`Geocoding failed for: ${addressKey} - Status: ${geocodeData.status}`);
          geocodedAddresses.set(addressKey, { success: false });
          results.push({
            locationId: location.id,
            success: false,
            error: `Geocoding failed: ${geocodeData.status}`
          });
          failCount++;
        }
      } catch (geocodeError) {
        console.error(`Error geocoding address ${addressKey}:`, geocodeError);
        geocodedAddresses.set(addressKey, { success: false });
        results.push({
          locationId: location.id,
          success: false,
          error: geocodeError instanceof Error ? geocodeError.message : 'Unknown error'
        });
        failCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Geocoding complete: ${successCount} successful, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        geocoded: successCount,
        failed: failCount,
        total: locations.length,
        results: results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in geocode-locations function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
