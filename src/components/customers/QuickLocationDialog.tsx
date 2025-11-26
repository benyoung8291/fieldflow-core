import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import AddressAutocomplete from "./AddressAutocomplete";

interface QuickLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName?: string;
  onLocationCreated: (locationId: string) => void;
}

export default function QuickLocationDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onLocationCreated,
}: QuickLocationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    location_notes: "",
    customer_location_id: "",
    latitude: null as number | null,
    longitude: null as number | null,
    facility_manager_contact_id: "",
    site_contact_id: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "",
      postcode: "",
      location_notes: "",
      customer_location_id: "",
      latitude: null,
      longitude: null,
      facility_manager_contact_id: "",
      site_contact_id: "",
    });
  };

  // Reset form when dialog opens or customer changes
  useEffect(() => {
    if (open) {
      resetForm();
      if (customerId) fetchContacts();
    }
  }, [open, customerId]);

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .eq("customer_id", customerId)
      .order("first_name");
    
    if (!error) setContacts(data || []);
  };

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
          location_notes: formData.location_notes || null,
          customer_location_id: formData.customer_location_id || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          facility_manager_contact_id: formData.facility_manager_contact_id || null,
          site_contact_id: formData.site_contact_id || null,
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

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-background border-l border-border shadow-lg z-50 overflow-y-auto">
      <div className="sticky top-0 bg-background border-b border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
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
        {customerName && (
          <p className="text-sm text-muted-foreground">
            Adding location for: <span className="font-medium text-foreground">{customerName}</span>
          </p>
        )}
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
              <Label>Site Contact</Label>
              <Select
                value={formData.site_contact_id}
                onValueChange={(value) => setFormData({ ...formData, site_contact_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select site contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Facility Manager</Label>
              <Select
                value={formData.facility_manager_contact_id}
                onValueChange={(value) => setFormData({ ...formData, facility_manager_contact_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select facility manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
