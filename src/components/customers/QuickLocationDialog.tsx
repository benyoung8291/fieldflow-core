import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import AddressAutocomplete from "./AddressAutocomplete";

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
    customer_location_id: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

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
          customer_location_id: formData.customer_location_id || null,
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
      customer_location_id: "",
      latitude: null,
      longitude: null,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-background border-l border-border shadow-lg z-50 overflow-y-auto">
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Create New Location</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="h-8 w-8 p-0"
        >
          ✕
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>Location Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Office"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Customer Location ID</Label>
            <Input
              value={formData.customer_location_id}
              onChange={(e) => setFormData({ ...formData, customer_location_id: e.target.value })}
              placeholder="External location reference ID"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Address</Label>
              <AddressAutocomplete
                value={formData.address}
                onChange={(value) => setFormData({ ...formData, address: value })}
                onPlaceSelect={(place) => setFormData({
                  ...formData,
                  address: place.address,
                  city: place.city,
                  state: place.state,
                  postcode: place.postcode,
                  latitude: place.latitude,
                  longitude: place.longitude,
                })}
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
    </div>
  );
}
