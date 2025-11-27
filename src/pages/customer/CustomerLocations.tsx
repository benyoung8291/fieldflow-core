import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function CustomerLocations() {
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customer_portal_users")
        .select("customer_id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: locations, isLoading } = useQuery({
    queryKey: ["customer-locations", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) {
        console.log("Customer portal: No customer_id for locations");
        return [];
      }

      console.log("Customer portal: Fetching locations for customer", profile.customer_id);
      const { data, error } = await supabase
        .from("customer_locations")
        .select(`
          *
        `)
        .eq("customer_id", profile.customer_id)
        .eq("archived", false);

      if (error) {
        console.error("Customer portal: Error fetching locations", error);
        throw error;
      }

      console.log("Customer portal: Locations loaded", data?.length || 0);

      // Get floor plan counts for each location
      const locationsWithCounts = await Promise.all(
        (data || []).map(async (location) => {
          const { count, error: countError } = await supabase
            .from("floor_plans")
            .select("*", { count: "exact", head: true })
            .eq("customer_location_id", location.id);
          
          if (countError) {
            console.error("Customer portal: Error counting floor plans", countError);
          }
          
          console.log(`Customer portal: Location ${location.name} has ${count || 0} floor plans`);
          return { ...location, floor_plans_count: count || 0 };
        })
      );

      return locationsWithCounts as Array<typeof data[0] & { floor_plans_count: number }>;
    },
    enabled: !!profile?.customer_id,
  });

  return (
    <CustomerPortalLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-base text-muted-foreground">
            View and manage your facility locations
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : locations && locations.length === 0 ? (
          <Card className="border-border/40 bg-card/50">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Locations Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Contact support to add locations to your account
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {locations?.map((location) => (
              <Card 
                key={location.id} 
                className="border-border/40 bg-card/50 hover-lift card-interactive overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardHeader className="space-y-3 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 flex-shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base font-semibold leading-snug line-clamp-2 flex-1">
                      {location.name}
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {(location.address || location.city || location.state || location.postcode) && (
                    <div className="text-sm text-muted-foreground space-y-1 min-h-[3rem]">
                      {location.address && (
                        <p className="line-clamp-1">{location.address}</p>
                      )}
                      {(location.city || location.state || location.postcode) && (
                        <p className="line-clamp-1">
                          {[location.city, location.state, location.postcode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-border/40">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">
                      {location.floor_plans_count || 0} floor plan{location.floor_plans_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <Link to={`/customer/locations/${location.id}/floor-plans`} className="block">
                    <Button 
                      className="w-full rounded-xl shadow-sm hover:shadow transition-all"
                      size="lg"
                    >
                      View Floor Plans
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CustomerPortalLayout>
  );
}
