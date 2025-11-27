import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectWithSearch } from "@/components/ui/select-with-search";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface QuickMarkupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickMarkupDialog({ open, onOpenChange }: QuickMarkupDialogProps) {
  const navigate = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<string>("");

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
      navigate(`/customer/locations/${selectedLocation}?floorPlan=${selectedFloorPlan}`);
      onOpenChange(false);
      // Reset selections
      setSelectedLocation("");
      setSelectedFloorPlan("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Markup Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="location">Select Location</Label>
            {locationsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SelectWithSearch
                value={selectedLocation}
                onValueChange={setSelectedLocation}
                options={
                  locations?.map((loc) => ({
                    label: loc.name,
                    value: loc.id,
                  })) || []
                }
                placeholder="Choose a location"
                searchPlaceholder="Search locations..."
                emptyText="No locations found"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="floor-plan">Select Floor Plan</Label>
            {floorPlansLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SelectWithSearch
                value={selectedFloorPlan}
                onValueChange={setSelectedFloorPlan}
                options={
                  floorPlans?.map((plan) => ({
                    label: `Level ${plan.floor_number} - ${plan.name}`,
                    value: plan.id,
                  })) || []
                }
                placeholder="Choose a floor plan"
                searchPlaceholder="Search floor plans..."
                emptyText={
                  selectedLocation
                    ? "No floor plans found for this location"
                    : "Please select a location first"
                }
              />
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!selectedLocation || !selectedFloorPlan}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
