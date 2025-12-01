import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { Loader2, MapPin, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickMarkupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickMarkupDialog({ open, onOpenChange }: QuickMarkupDialogProps) {
  const navigate = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<string>("");

  const { data: profile } = useCustomerProfile();

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["customer-locations", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", profile.customer_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  // Auto-select location if there's only one
  useEffect(() => {
    if (locations && locations.length === 1 && !selectedLocation) {
      setSelectedLocation(locations[0].id);
    }
  }, [locations, selectedLocation]);

  const { data: floorPlans, isLoading: floorPlansLoading } = useQuery({
    queryKey: ["floor-plans", selectedLocation],
    queryFn: async () => {
      if (!selectedLocation) return [];

      const { data, error } = await supabase
        .from("floor_plans")
        .select("*")
        .eq("customer_location_id", selectedLocation)
        .order("floor_number");

      if (error) throw error;
      return data;
    },
    enabled: !!selectedLocation,
  });

  const handleContinue = () => {
    if (selectedLocation && selectedFloorPlan) {
      navigate(`/customer/locations/${selectedLocation}/floor-plans?floorPlan=${selectedFloorPlan}`);
      onOpenChange(false);
      // Reset selections
      setSelectedLocation("");
      setSelectedFloorPlan("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Markup Request</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select a location and floor plan to start marking up
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Locations */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Select Location</h3>
            </div>
            {locationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : locations && locations.length > 0 ? (
              <div className="grid gap-3">
                {locations.map((location) => (
                  <Card
                    key={location.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      selectedLocation === location.id
                        ? "ring-2 ring-primary shadow-sm"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => {
                      setSelectedLocation(location.id);
                      setSelectedFloorPlan(""); // Reset floor plan when location changes
                    }}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          selectedLocation === location.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}>
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{location.name}</p>
                          {location.address && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {location.address}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedLocation === location.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No locations available</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Floor Plans */}
          {selectedLocation && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Select Floor Plan</h3>
              </div>
              {floorPlansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : floorPlans && floorPlans.length > 0 ? (
                <div className="grid gap-3">
                  {floorPlans.map((plan) => (
                    <Card
                      key={plan.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedFloorPlan === plan.id
                          ? "ring-2 ring-primary shadow-sm"
                          : "hover:border-primary/50"
                      )}
                      onClick={() => setSelectedFloorPlan(plan.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            selectedFloorPlan === plan.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}>
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">
                              Level {plan.floor_number} - {plan.name}
                            </p>
                          </div>
                        </div>
                        {selectedFloorPlan === plan.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No floor plans available for this location</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!selectedLocation || !selectedFloorPlan}
            size="lg"
          >
            Continue to Markup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
