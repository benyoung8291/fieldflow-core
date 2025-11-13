import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Trigger geocoding for all locations belonging to a customer that don't have coordinates
 */
export async function geocodeCustomerLocations(customerId: string) {
  try {
    // Get all locations without coordinates
    const { data: locations, error: fetchError } = await supabase
      .from("customer_locations")
      .select("id")
      .eq("customer_id", customerId)
      .is("latitude", null);

    if (fetchError) throw fetchError;

    if (!locations || locations.length === 0) {
      toast.info("All locations already have coordinates");
      return;
    }

    const locationIds = locations.map(loc => loc.id);
    
    toast.info(`Starting geocoding for ${locationIds.length} locations...`);

    // Call the geocode edge function
    const { data, error } = await supabase.functions.invoke("geocode-locations", {
      body: { locationIds }
    });

    if (error) throw error;

    toast.success(`Geocoding completed: ${data.geocoded} locations updated successfully`);
    
    if (data.failed > 0) {
      toast.warning(`${data.failed} locations failed to geocode`);
    }

    return data;
  } catch (error: any) {
    console.error("Geocoding error:", error);
    toast.error(`Failed to geocode locations: ${error.message}`);
    throw error;
  }
}
