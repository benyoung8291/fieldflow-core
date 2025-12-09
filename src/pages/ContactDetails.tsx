import { useParams, useNavigate } from "react-router-dom";
import { useLogDetailPageAccess } from "@/hooks/useLogDetailPageAccess";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DocumentDetailLayout from "@/components/layout/DocumentDetailLayout";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, Building2, Globe, Linkedin, Calendar, User, FileText, Briefcase, ArrowRight, Edit, Archive, Trash2, Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ContactManagementDialog from "@/components/contacts/ContactManagementDialog";
import { QuickActionsMenu } from "@/components/quick-actions/QuickActionsMenu";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import ContactActivityTimeline from "@/components/contacts/ContactActivityTimeline";

export default function ContactDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    company_name: "",
    notes: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Log data access for audit trail
  useLogDetailPageAccess('contacts', id);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          customer:customers(id, name),
          supplier:suppliers(id, name),
          lead:leads(id, company_name, status),
          assigned_user:profiles!contacts_assigned_to_fkey(id, first_name, last_name, email)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Contact not found");

      return {
        ...data,
        assigned_user: data.assigned_user ? {
          ...data.assigned_user,
          full_name: `${data.assigned_user.first_name || ''} ${data.assigned_user.last_name || ''}`.trim()
        } : null
      };
    },
  });

  const convertToLeadMutation = useMutation({
    mutationFn: async () => {
      if (!contact) return;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create lead with company details
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name: leadFormData.company_name || contact.company_name || `${contact.first_name} ${contact.last_name}`,
          company_name: leadFormData.company_name || contact.company_name,
          email: contact.email,
          phone: contact.phone,
          mobile: contact.mobile,
          address: contact.address,
          city: contact.city,
          state: contact.state,
          postcode: contact.postcode,
          notes: leadFormData.notes || contact.notes,
          source: contact.source || "Contact Conversion",
          assigned_to: contact.assigned_to,
          status: "new",
          created_by: user.id,
          tenant_id: contact.tenant_id,
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Update contact to link to lead and change status only
      const { error: contactError } = await supabase
        .from("contacts")
        .update({
          lead_id: lead.id,
          status: "lead",
        })
        .eq("id", id);

      if (contactError) throw contactError;

      return lead;
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact converted to lead successfully");
      setConvertDialogOpen(false);
      setLeadFormData({ company_name: "", notes: "" });
      // Navigate to the new lead
      if (lead) {
        navigate(`/leads/${lead.id}`);
      }
    },
    onError: (error) => {
      console.error("Error converting contact:", error);
      toast.error("Failed to convert contact to lead");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contacts")
        .update({ status: "inactive" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact archived successfully");
    },
    onError: (error) => {
      console.error("Error archiving contact:", error);
      toast.error("Failed to archive contact");
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contacts")
        .update({ status: "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact unarchived successfully");
    },
    onError: (error) => {
      console.error("Error unarchiving contact:", error);
      toast.error("Failed to unarchive contact");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact deleted permanently");
      navigate("/contacts");
    },
    onError: (error) => {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    },
  });

  const handleDeleteClick = () => {
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmText.toLowerCase() === "delete") {
      deleteMutation.mutate();
      setDeleteDialogOpen(false);
    }
  };

  const getContactTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      prospect: "Prospect",
      lead: "Lead",
      customer_contact: "Customer Contact",
      supplier_contact: "Supplier Contact",
      other: "Other",
    };
    return labels[type] || type;
  };

  const getContactTypeColor = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    const colors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      prospect: "secondary",
      lead: "default",
      customer_contact: "default",
      supplier_contact: "secondary",
      other: "outline",
    };
    return colors[type] || "outline";
  };

  const getStatusColor = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    const colors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      active: "default",
      inactive: "outline",
      converted: "secondary",
      unqualified: "destructive",
    };
    return colors[status] || "outline";
  };

  if (!contact) {
    return null;
  }

  const showConvertToLead = contact.contact_type === "prospect" && contact.status !== "converted";
  const isArchived = contact.status === "inactive";

  const primaryActions = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => setEditDialogOpen(true),
      variant: "outline" as const,
    },
    ...(showConvertToLead ? [{
      label: "Convert to Lead",
      icon: <ArrowRight className="h-4 w-4" />,
      onClick: () => setConvertDialogOpen(true),
      variant: "default" as const,
    }] : []),
    ...(isArchived ? [{
      label: "Unarchive",
      icon: <Archive className="h-4 w-4" />,
      onClick: () => unarchiveMutation.mutate(),
      variant: "outline" as const,
    }] : [{
      label: "Archive",
      icon: <Archive className="h-4 w-4" />,
      onClick: () => archiveMutation.mutate(),
      variant: "outline" as const,
    }]),
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleDeleteClick,
      variant: "destructive" as const,
    },
  ];

  const keyInfoItems = [
    {
      label: "Type",
      value: getContactTypeLabel(contact.contact_type),
      icon: User,
    },
    {
      label: "Status",
      value: contact.status.charAt(0).toUpperCase() + contact.status.slice(1),
      icon: Briefcase,
    },
    ...(contact.company_name ? [{
      label: "Company",
      value: contact.company_name,
      icon: Building2,
    }] : []),
    ...(contact.position ? [{
      label: "Position",
      value: contact.position,
      icon: Briefcase,
    }] : []),
  ];

  const tabs = [
    {
      value: "details",
      label: "Details",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-3">
          <div className="space-y-4">
            <div className="bg-card border rounded-lg p-3">
              <h3 className="font-semibold mb-3 text-sm">Contact Information</h3>
              <div className="space-y-2.5">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.phone}`} className="hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                )}
                {contact.mobile && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${contact.mobile}`} className="hover:underline">
                      {contact.mobile} <span className="text-muted-foreground">(Mobile)</span>
                    </a>
                  </div>
                )}
                {contact.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {contact.website}
                    </a>
                  </div>
                )}
                {contact.linkedin_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      LinkedIn Profile
                    </a>
                  </div>
                )}
              </div>
            </div>

            {(contact.address || contact.city || contact.state || contact.postcode) && (
              <div className="bg-card border rounded-lg p-3">
                <h3 className="font-semibold mb-3 text-sm">Address</h3>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    {contact.address && <div>{contact.address}</div>}
                    {(contact.city || contact.state || contact.postcode) && (
                      <div>
                        {[contact.city, contact.state, contact.postcode].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {contact.assigned_user && (
              <div className="bg-card border rounded-lg p-3">
                <h3 className="font-semibold mb-3 text-sm">Assignment</h3>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.assigned_user.full_name}</span>
                </div>
              </div>
            )}

            {contact.notes && (
              <div className="bg-card border rounded-lg p-3">
                <h3 className="font-semibold mb-3 text-sm">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}

            <div className="bg-card border rounded-lg p-3">
              <h3 className="font-semibold mb-3 text-sm">Additional Information</h3>
              <div className="space-y-2 text-sm">
                {contact.source && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Source:</span>
                    <span>{contact.source}</span>
                  </div>
                )}
                {contact.last_contacted_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last Contacted:</span>
                    <span>{new Date(contact.last_contacted_at).toLocaleDateString()}</span>
                  </div>
                )}
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground">Tags:</span>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Activity Timeline</h3>
              </div>
              <ContactActivityTimeline contactId={id!} />
            </div>
          </div>
        </div>
      ),
    },
    {
      value: "related",
      label: "Related",
      content: (
        <div className="space-y-4 p-3">
          {contact.customer && (
            <div className="bg-card border rounded-lg p-3">
              <h3 className="font-semibold mb-3 text-sm">Customer</h3>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => navigate(`/customers/${contact.customer.id}`)}
              >
                {contact.customer.name}
              </Button>
            </div>
          )}
          
          {contact.supplier && (
            <div className="bg-card border rounded-lg p-3">
              <h3 className="font-semibold mb-3 text-sm">Supplier</h3>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => navigate(`/suppliers/${contact.supplier.id}`)}
              >
                {contact.supplier.name}
              </Button>
            </div>
          )}
          
          {contact.lead && (
            <div className="bg-card border rounded-lg p-3">
              <h3 className="font-semibold mb-3 text-sm">Lead</h3>
              <div className="space-y-2">
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => navigate(`/leads/${contact.lead.id}`)}
                >
                  {contact.lead.company_name || `${contact.first_name} ${contact.last_name}`}
                </Button>
                <div className="text-xs text-muted-foreground">
                  Status: {contact.lead.status}
                </div>
              </div>
            </div>
          )}

          {!contact.customer && !contact.supplier && !contact.lead && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No related records
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DocumentDetailLayout
        title={`${contact.first_name} ${contact.last_name}`}
        subtitle={contact.company_name}
        backPath="/contacts"
        statusBadges={[
          {
            label: getContactTypeLabel(contact.contact_type),
            variant: getContactTypeColor(contact.contact_type),
          },
          {
            label: contact.status.charAt(0).toUpperCase() + contact.status.slice(1),
            variant: getStatusColor(contact.status),
          },
        ]}
        primaryActions={primaryActions}
        customActions={
          <QuickActionsMenu 
            customerId={contact.customer?.id} 
            leadId={contact.lead?.id}
            variant="outline"
          />
        }
        keyInfoSection={
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
            {keyInfoItems.map((item, index) => (
              <div key={index} className="bg-card border rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  {item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <div className="text-sm font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        }
        tabs={tabs}
        isLoading={isLoading}
      />

      <ContactManagementDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
      />

      <Dialog open={convertDialogOpen} onOpenChange={(open) => {
        setConvertDialogOpen(open);
        if (!open) {
          setLeadFormData({ company_name: "", notes: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Contact to Lead</DialogTitle>
            <DialogDescription>
              Create a new lead record and link {contact?.first_name} {contact?.last_name} to it. The contact will remain intact with status changed to "Lead".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company-name"
                value={leadFormData.company_name}
                onChange={(e) => setLeadFormData({ ...leadFormData, company_name: e.target.value })}
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-notes">Additional Notes</Label>
              <Textarea
                id="lead-notes"
                value={leadFormData.notes}
                onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                placeholder="Add any notes about this lead..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!leadFormData.company_name.trim()) {
                  toast.error("Company name is required");
                  return;
                }
                convertToLeadMutation.mutate();
                setConvertDialogOpen(false);
              }}
              disabled={convertToLeadMutation.isPending}
            >
              {convertToLeadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Convert to Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the contact from the system.
              If you want to keep historic data, use the Archive button instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-bold">delete</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                placeholder="Type 'delete' to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmText.toLowerCase() !== "delete"}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
