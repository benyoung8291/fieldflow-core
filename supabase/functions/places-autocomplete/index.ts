import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();
    
    if (!input || input.trim().length < 3) {
      return new Response(
        JSON.stringify({ predictions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      throw new Error("Google Places API key not configured");
    }

    // Call Google Places Autocomplete API
    const autocompleteUrl = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    autocompleteUrl.searchParams.append("input", input);
    autocompleteUrl.searchParams.append("components", "country:au");
    autocompleteUrl.searchParams.append("key", apiKey);

    const autocompleteResponse = await fetch(autocompleteUrl.toString());
    const autocompleteData = await autocompleteResponse.json();

    return new Response(
      JSON.stringify(autocompleteData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in places-autocomplete:", error);
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
