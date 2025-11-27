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
        .from("profiles")
        .select("customer_id")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: locations, isLoading } = useQuery({
    queryKey: ["customer-locations", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("customer_locations")
        .select(`
          *,
          floor_plans:floor_plans(count)
        `)
        .eq("customer_id", profile.customer_id)
        .eq("archived", false);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  return (
    <CustomerPortalLayout>
      <div className="space-y-6 pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold">My Locations</h1>
          <p className="text-muted-foreground">
            View and manage your facility locations
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : locations && locations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Locations Found</h3>
              <p className="text-muted-foreground">
                Contact support to add locations to your account
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations?.map((location) => (
              <Card key={location.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{location.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground space-y-1">
                    {location.address && <p>{location.address}</p>}
                    {(location.city || location.state || location.postcode) && (
                      <p>
                        {[location.city, location.state, location.postcode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>
                      {location.floor_plans?.[0]?.count || 0} floor plan(s)
                    </span>
                  </div>

                  <Link to={`/customer/locations/${location.id}/floor-plans`}>
                    <Button className="w-full">View Floor Plans</Button>
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
