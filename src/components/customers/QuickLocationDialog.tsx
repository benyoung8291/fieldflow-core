import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";

interface QuickLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onLocationCreated: (locationId: string) => void;
}

export default function QuickLocationDialog({
  open,
  onOpenChange,
  customerId,
  onLocationCreated,
}: QuickLocationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    location_notes: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!open || !addressInputRef.current) return;

    const initAutocomplete = async () => {
      try {
        const loader = new Loader({
          apiKey: import.meta.env.VITE_GOOGLE_PLACES_API_KEY || "",
          version: "weekly",
          libraries: ["places"],
        });

        // @ts-ignore - Loader types may be incomplete
        await loader.load();

        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          addressInputRef.current!,
          {
            componentRestrictions: { country: "au" },
            fields: ["address_components", "formatted_address", "geometry"],
          }
        );

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current?.getPlace();
          if (!place || !place.geometry) return;

          const addressComponents = place.address_components || [];
          let street = "";
          let city = "";
          let state = "";
          let postcode = "";

          addressComponents.forEach((component) => {
            const types = component.types;
            if (types.includes("street_number")) {
              street = component.long_name + " " + street;
            }
            if (types.includes("route")) {
              street += component.long_name;
            }
            if (types.includes("locality")) {
              city = component.long_name;
            }
            if (types.includes("administrative_area_level_1")) {
              state = component.short_name;
            }
            if (types.includes("postal_code")) {
              postcode = component.long_name;
            }
          });

          setFormData((prev) => ({
            ...prev,
            address: street || place.formatted_address || "",
            city,
            state,
            postcode,
            latitude: place.geometry.location?.lat() || null,
            longitude: place.geometry.location?.lng() || null,
          }));
        });
      } catch (error) {
        console.error("Error loading Google Maps:", error);
      }
    };

    initAutocomplete();

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("customer_locations")
        .insert({
          tenant_id: profile?.tenant_id,
          customer_id: customerId,
          name: formData.name,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          postcode: formData.postcode || null,
          contact_name: formData.contact_name || null,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          location_notes: formData.location_notes || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Location created successfully" });
      onLocationCreated(data.id);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error creating location",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "",
      postcode: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      location_notes: "",
      latitude: null,
      longitude: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Location</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Location Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Office"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Address</Label>
              <Input
                ref={addressInputRef}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Start typing to search address..."
              />
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="City"
              />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="State"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Postcode</Label>
              <Input
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                placeholder="Postcode"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Site contact"
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.location_notes}
              onChange={(e) => setFormData({ ...formData, location_notes: e.target.value })}
              placeholder="Any additional notes about this location..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Location
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
