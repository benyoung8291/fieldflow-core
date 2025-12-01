import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContactRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  serviceOrderId: string;
  currentSiteContactId?: string | null;
  currentFacilityManagerId?: string | null;
  role: "site_contact" | "facility_manager";
  onSuccess: () => void;
}

export function ContactRoleDialog({
  open,
  onOpenChange,
  customerId,
  serviceOrderId,
  currentSiteContactId,
  currentFacilityManagerId,
  role,
  onSuccess,
}: ContactRoleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [newContact, setNewContact] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    position: "",
  });

  useEffect(() => {
    if (open && customerId) {
      fetchContacts();
    }
  }, [open, customerId]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, position")
        .eq("customer_id", customerId)
        .order("first_name");

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching contacts",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLink = async () => {
    if (!selectedContactId) return;

    setLoading(true);
    try {
      const updateData = role === "site_contact"
        ? { customer_contact_id: selectedContactId }
        : { facility_manager_contact_id: selectedContactId };

      const { error } = await supabase
        .from("service_orders")
        .update(updateData)
        .eq("id", serviceOrderId);

      if (error) throw error;

      toast({ title: `${role === "site_contact" ? "Site contact" : "Facility manager"} linked successfully` });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error linking contact",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newContact.first_name || !newContact.last_name) {
      toast({
        title: "Required fields missing",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Create the contact
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          ...newContact,
          customer_id: customerId,
          tenant_id: profile.tenant_id,
          contact_type: "customer",
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // Link to service order
      const updateData = role === "site_contact"
        ? { customer_contact_id: contact.id }
        : { facility_manager_contact_id: contact.id };

      const { error: updateError } = await supabase
        .from("service_orders")
        .update(updateData)
        .eq("id", serviceOrderId);

      if (updateError) throw updateError;

      toast({ title: "Contact created and linked successfully" });
      onSuccess();
      onOpenChange(false);
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

  const roleLabel = role === "site_contact" ? "Site Contact" : "Facility Manager";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link or Create {roleLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === "select" ? "default" : "outline"}
              onClick={() => setMode("select")}
              className="flex-1"
            >
              Link Existing
            </Button>
            <Button
              variant={mode === "create" ? "default" : "outline"}
              onClick={() => setMode("create")}
              className="flex-1"
            >
              Create New
            </Button>
          </div>

          {mode === "select" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Contact</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                        {contact.position && ` - ${contact.position}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleLink}
                  disabled={!selectedContactId || loading}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Link Contact
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    value={newContact.first_name}
                    onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={newContact.last_name}
                    onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Position</Label>
                <Input
                  value={newContact.position}
                  onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                  placeholder="Job title"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="Phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input
                    value={newContact.mobile}
                    onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value })}
                    placeholder="Mobile"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create & Link
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
