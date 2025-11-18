import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LocationProgress {
  id: string;
  name: string;
  address: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  latitude?: number;
  longitude?: number;
  error?: string;
  needsConfirmation?: boolean;
}

export interface GeocodeOptions {
  onProgress?: (locations: LocationProgress[], currentIndex: number) => void;
  onLocationNeedsConfirmation?: (locationId: string, error: string) => Promise<boolean>;
}

/**
 * Geocode locations one at a time with real-time progress updates
 */
export async function geocodeCustomerLocationsWithProgress(
  customerId: string,
  options: GeocodeOptions = {}
): Promise<LocationProgress[]> {
  try {
    // Get all locations without coordinates
    const { data: locations, error: fetchError } = await supabase
      .from("customer_locations")
      .select("id, name, address, city, state, postcode")
      .eq("customer_id", customerId)
      .is("latitude", null);

    if (fetchError) throw fetchError;

    if (!locations || locations.length === 0) {
      toast.info("All locations already have coordinates");
      return [];
    }

    // Initialize progress tracking
    const progressLocations: LocationProgress[] = locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      address: `${loc.address || ''}, ${loc.city || ''}, ${loc.state || ''} ${loc.postcode || ''}`.trim(),
      status: 'pending'
    }));

    // Process each location sequentially
    for (let i = 0; i < progressLocations.length; i++) {
      const location = progressLocations[i];
      location.status = 'processing';
      
      options.onProgress?.(progressLocations, i);

      try {
        // Call geocode function for single location
        const { data, error } = await supabase.functions.invoke("geocode-locations", {
          body: { locationIds: [location.id] }
        });

        if (error) throw error;

        if (data?.results && data.results.length > 0) {
          const result = data.results[0];
          
          if (result.success) {
            location.status = 'success';
            location.latitude = result.latitude;
            location.longitude = result.longitude;
          } else {
            // Location failed - ask for confirmation
            location.status = 'error';
            location.error = result.error || 'Failed to geocode';
            location.needsConfirmation = true;

            if (options.onLocationNeedsConfirmation) {
              const shouldRetry = await options.onLocationNeedsConfirmation(
                location.id,
                location.error
              );

              if (shouldRetry) {
                // Retry once more
                const { data: retryData, error: retryError } = await supabase.functions.invoke("geocode-locations", {
                  body: { locationIds: [location.id] }
                });

                if (!retryError && retryData?.results?.[0]?.success) {
                  location.status = 'success';
                  location.latitude = retryData.results[0].latitude;
                  location.longitude = retryData.results[0].longitude;
                  location.needsConfirmation = false;
                } else {
                  location.status = 'skipped';
                  location.needsConfirmation = false;
                }
              } else {
                location.status = 'skipped';
                location.needsConfirmation = false;
              }
            }
          }
        } else {
          location.status = 'error';
          location.error = 'No response from geocoding service';
        }

      } catch (error: any) {
        location.status = 'error';
        location.error = error.message || 'Unknown error';
        console.error(`Geocoding error for location ${location.id}:`, error);
      }

      options.onProgress?.(progressLocations, i);
    }

    const successCount = progressLocations.filter(l => l.status === 'success').length;
    const failedCount = progressLocations.filter(l => l.status === 'error').length;
    const skippedCount = progressLocations.filter(l => l.status === 'skipped').length;

    if (successCount > 0) {
      toast.success(`Successfully geocoded ${successCount} location${successCount !== 1 ? 's' : ''}`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} location${failedCount !== 1 ? 's' : ''} failed to geocode`);
    }
    if (skippedCount > 0) {
      toast.info(`${skippedCount} location${skippedCount !== 1 ? 's' : ''} skipped`);
    }

    return progressLocations;

  } catch (error: any) {
    console.error("Geocoding error:", error);
    toast.error(`Failed to geocode locations: ${error.message}`);
    throw error;
  }
}

/**
 * Legacy function for backwards compatibility
 */
export async function geocodeCustomerLocations(customerId: string) {
  return geocodeCustomerLocationsWithProgress(customerId);
}
