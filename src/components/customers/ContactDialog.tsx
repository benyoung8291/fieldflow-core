import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: any;
  customerId: string;
}

export default function ContactDialog({ open, onOpenChange, contact, customerId }: ContactDialogProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    position: "",
    isPrimary: false,
    notes: "",
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        email: contact.email || "",
        phone: contact.phone || "",
        mobile: contact.mobile || "",
        position: contact.position || "",
        isPrimary: contact.isPrimary || false,
        notes: contact.notes || "",
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        mobile: "",
        position: "",
        isPrimary: false,
        notes: "",
      });
    }
  }, [contact, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

      if (contact) {
        // Update existing contact
        const { error } = await supabase
          .from("contacts")
          .update({
            first_name: formData.firstName,
            last_name: formData.lastName,
            position: formData.position || null,
            email: formData.email || null,
            phone: formData.phone || null,
            mobile: formData.mobile || null,
            notes: formData.notes || null,
            is_primary: formData.isPrimary,
          })
          .eq("id", contact.id);

        if (error) throw error;
      } else {
        // Create new contact
        const { error } = await supabase
          .from("contacts")
          .insert({
            tenant_id: profile.tenant_id,
            customer_id: customerId,
            first_name: formData.firstName,
            last_name: formData.lastName,
            position: formData.position || null,
            email: formData.email || null,
            phone: formData.phone || null,
            mobile: formData.mobile || null,
            notes: formData.notes || null,
            is_primary: formData.isPrimary,
            contact_type: "customer_contact",
            status: "active",
          });

        if (error) throw error;
      }

      toast.success(contact ? "Contact updated successfully" : "Contact added successfully");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Error saving contact: " + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {contact ? "Edit Contact" : "Add Contact"}
          </DialogTitle>
          <DialogDescription>
            {contact ? "Update contact information" : "Add a new contact person"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              placeholder="e.g., General Manager, Facilities Manager"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes about this contact..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isPrimary"
              checked={formData.isPrimary}
              onCheckedChange={(checked) => setFormData({ ...formData, isPrimary: checked })}
            />
            <Label htmlFor="isPrimary">Set as Primary Contact</Label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {contact ? "Update" : "Add"} Contact
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
