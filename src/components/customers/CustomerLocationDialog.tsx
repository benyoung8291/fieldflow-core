import { useState } from "react";
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
import AddressAutocomplete from "./AddressAutocomplete";

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
  customer_location_id: string;
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
      customer_location_id: "",
      is_primary: false,
      is_active: true,
      latitude: null,
      longitude: null,
    },
  });

  const isPrimary = watch("is_primary");
  const isActive = watch("is_active");
  const address = watch("address");

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
              <Label htmlFor="customer_location_id">Customer Location ID</Label>
              <Input 
                id="customer_location_id" 
                {...register("customer_location_id")} 
                placeholder="External location reference ID"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                value={address}
                onChange={(value) => setValue("address", value)}
                onPlaceSelect={(place) => {
                  setValue("address", place.address);
                  setValue("city", place.city);
                  setValue("state", place.state);
                  setValue("postcode", place.postcode);
                  setValue("latitude", place.latitude);
                  setValue("longitude", place.longitude);
                }}
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
