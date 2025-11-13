import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { placeId, address } = await req.json();
    
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      throw new Error("Google Places API key not configured");
    }

    // If address is provided, use Geocoding API
    if (address) {
      const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      geocodeUrl.searchParams.append("address", address);
      geocodeUrl.searchParams.append("components", "country:AU");
      geocodeUrl.searchParams.append("key", apiKey);
      
      const geocodeResponse = await fetch(geocodeUrl.toString());
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status === "OK" && geocodeData.results && geocodeData.results.length > 0) {
        const result = geocodeData.results[0];
        return new Response(
          JSON.stringify({
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            formatted_address: result.formatted_address,
            address_components: result.address_components
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: `Geocoding failed: ${geocodeData.status}` }),
          { 
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }
    
    // If placeId is provided, use Places Details API
    if (placeId) {
      const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailsUrl.searchParams.append("place_id", placeId);
      detailsUrl.searchParams.append("fields", "address_components,formatted_address,geometry");
      detailsUrl.searchParams.append("key", apiKey);

      const detailsResponse = await fetch(detailsUrl.toString());
      const detailsData = await detailsResponse.json();

      return new Response(
        JSON.stringify(detailsData),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    throw new Error("Either placeId or address is required");
  } catch (error) {
    console.error("Error in places-details:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
