import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface QuickContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  locationId?: string;
  assignAsRole?: 'site_contact' | 'facility_manager' | null;
  onContactCreated: (contactId: string, role?: 'site_contact' | 'facility_manager' | null) => void;
}

export default function QuickContactDialog({
  open,
  onOpenChange,
  customerId,
  locationId,
  assignAsRole,
  onContactCreated,
}: QuickContactDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'site_contact' | 'facility_manager' | null>(assignAsRole || null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    position: "",
    email: "",
    phone: "",
    mobile: "",
    notes: "",
  });

  // Sync selectedRole when assignAsRole prop changes
  useEffect(() => {
    if (open) {
      setSelectedRole(assignAsRole || null);
    }
  }, [open, assignAsRole]);

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
      
      if (!profile?.tenant_id) {
        throw new Error("Unable to determine tenant. Please refresh and try again.");
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: customerId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          position: formData.position || null,
          email: formData.email || null,
          phone: formData.phone || null,
          mobile: formData.mobile || null,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If locationId and role are provided, update the location
      if (locationId && selectedRole) {
        const updateField = selectedRole === 'site_contact' ? 'site_contact_id' : 'facility_manager_contact_id';
        const { error: locationError } = await supabase
          .from("customer_locations")
          .update({ [updateField]: data.id })
          .eq("id", locationId);

        if (locationError) {
          console.error("Error updating location contact:", locationError);
          // Don't throw - contact was created successfully
          toast({ 
            title: "Contact created", 
            description: "Contact created but couldn't assign role. Please assign manually.",
            variant: "default" 
          });
        } else {
          toast({ 
            title: "Contact created and assigned", 
            description: `${formData.first_name} ${formData.last_name} has been assigned as ${selectedRole === 'site_contact' ? 'Site Contact' : 'Facility Manager'}`
          });
        }
      } else {
        toast({ title: "Contact created successfully" });
      }

      onContactCreated(data.id, selectedRole);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error creating contact",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      position: "",
      email: "",
      phone: "",
      mobile: "",
      notes: "",
    });
    setSelectedRole(assignAsRole || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {locationId && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
              <Label>Assign Contact Role (Optional)</Label>
              <Select 
                value={selectedRole || "none"} 
                onValueChange={(value) => setSelectedRole(value === "none" ? null : value as 'site_contact' | 'facility_manager')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific role</SelectItem>
                  <SelectItem value="site_contact">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Site</Badge>
                      Site Contact
                    </div>
                  </SelectItem>
                  <SelectItem value="facility_manager">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Facility</Badge>
                      Facility Manager
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Assign this contact to a specific role for the selected location
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="First name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Last name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Position</Label>
            <Input
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              placeholder="e.g., Operations Manager"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Mobile</Label>
              <Input
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="Mobile number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Contact
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
