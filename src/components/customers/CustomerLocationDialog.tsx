import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader } from "@googlemaps/js-api-loader";

interface CustomerLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  tenantId: string;
  location?: any;
}

interface LocationFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  location_notes: string;
  is_primary: boolean;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export default function CustomerLocationDialog({
  open,
  onOpenChange,
  customerId,
  tenantId,
  location,
}: CustomerLocationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  const { register, handleSubmit, watch, setValue } = useForm<LocationFormData>({
    defaultValues: location || {
      name: "",
      address: "",
      city: "",
      state: "",
      postcode: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      location_notes: "",
      is_primary: false,
      is_active: true,
      latitude: null,
      longitude: null,
    },
  });

  const isPrimary = watch("is_primary");
  const isActive = watch("is_active");

  useEffect(() => {
    if (!open || !addressInputRef.current) return;

    const initAutocomplete = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      
      if (!apiKey) {
        console.warn("Google Places API key not found. Address autocomplete disabled.");
        return;
      }

      try {
        const loader = new Loader({
          apiKey,
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

          setValue("address", street || place.formatted_address || "");
          setValue("city", city);
          setValue("state", state);
          setValue("postcode", postcode);
          setValue("latitude", place.geometry.location?.lat() || null);
          setValue("longitude", place.geometry.location?.lng() || null);
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
  }, [open, setValue]);

  const onSubmit = async (data: LocationFormData) => {
    setIsSubmitting(true);
    try {
      if (location) {
        const { error } = await supabase
          .from("customer_locations")
          .update(data)
          .eq("id", location.id);

        if (error) throw error;
        toast.success("Location updated successfully");
      } else {
        const { error } = await supabase
          .from("customer_locations")
          .insert({
            ...data,
            customer_id: customerId,
            tenant_id: tenantId,
          });

        if (error) throw error;
        toast.success("Location created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["customer-locations", customerId] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{location ? "Edit Location" : "New Location"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Location Name *</Label>
              <Input id="name" {...register("name")} required />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address" 
                {...register("address")}
                ref={(e) => {
                  register("address").ref(e);
                  addressInputRef.current = e;
                }}
                placeholder="Start typing to search address..."
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("city")} />
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register("state")} />
            </div>

            <div className="col-span-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" {...register("postcode")} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-4">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input id="contact_name" {...register("contact_name")} />
              </div>

              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input id="contact_phone" type="tel" {...register("contact_phone")} />
              </div>

              <div>
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input id="contact_email" type="email" {...register("contact_email")} />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="location_notes">Notes</Label>
            <Textarea id="location_notes" {...register("location_notes")} rows={3} />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="is_primary"
                checked={isPrimary}
                onCheckedChange={(checked) => setValue("is_primary", checked)}
              />
              <Label htmlFor="is_primary">Primary Location</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={(checked) => setValue("is_active", checked)}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : location ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
