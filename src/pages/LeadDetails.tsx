import { useParams, useNavigate } from "react-router-dom";
import { useLogDetailPageAccess } from "@/hooks/useLogDetailPageAccess";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DocumentDetailLayout from "@/components/layout/DocumentDetailLayout";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, Building2, User, FileText, TrendingUp, Edit, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import LeadDialog from "@/components/leads/LeadDialog";
import CustomerDialog from "@/components/customers/CustomerDialog";
import QuoteHeaderDialog from "@/components/quotes/QuoteHeaderDialog";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import { QuickActionsMenu } from "@/components/quick-actions/QuickActionsMenu";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { usePresenceSystem } from "@/hooks/usePresenceSystem";

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [contactActionDialogOpen, setContactActionDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'delete' | 'archive' | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [archiveContacts, setArchiveContacts] = useState(false);
  const [inactivateContacts, setInactivateContacts] = useState(false);

  // Log data access for audit trail
  useLogDetailPageAccess('leads', id);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          assigned_user:profiles!leads_assigned_to_fkey(id, first_name, last_name, email),
          created_user:profiles!leads_created_by_fkey(id, first_name, last_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Handle foreign key relationships that return as arrays
      const assignedUser = Array.isArray(data.assigned_user) ? data.assigned_user[0] : data.assigned_user;
      const createdUser = Array.isArray(data.created_user) ? data.created_user[0] : data.created_user;

      return {
        ...data,
        assigned_user: assignedUser ? {
          ...assignedUser,
          full_name: `${assignedUser.first_name || ''} ${assignedUser.last_name || ''}`.trim()
        } : null,
        created_user: createdUser ? {
          ...createdUser,
          full_name: `${createdUser.first_name || ''} ${createdUser.last_name || ''}`.trim()
        } : null
      };
    },
  });

  // Track presence on this lead
  usePresenceSystem({
    trackPresence: true,
    documentId: id,
    documentType: "leads",
    documentName: lead?.company_name ? `Lead: ${lead.company_name}` : undefined,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["lead-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false});

      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", id)
        .order("activity_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["lead-quotes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Real-time subscription for quotes
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel('lead-quotes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `lead_id=eq.${id}`
        },
        () => {
          // Invalidate and refetch quotes when changes occur
          queryClient.invalidateQueries({ queryKey: ["lead-quotes", id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const handleCustomerCreated = async (customerId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update lead with conversion info
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          converted_to_customer_id: customerId,
          converted_at: new Date().toISOString(),
          converted_by: user.id,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Update linked contacts to reference customer
      if (contacts.length > 0) {
        const { error: contactsError } = await supabase
          .from("contacts")
          .update({
            customer_id: customerId,
            contact_type: "customer",
            status: "active",
          })
          .eq("lead_id", id);

        if (contactsError) throw contactsError;
      }

      // Update any quotes from lead to customer
      const { error: quotesError } = await supabase
        .from("quotes")
        .update({
          customer_id: customerId,
          lead_id: null,
          is_for_lead: false,
        })
        .eq("lead_id", id);

      if (quotesError) throw quotesError;

      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead converted to customer successfully");
      navigate(`/customers/${customerId}`);
    } catch (error) {
      console.error("Error converting lead:", error);
      toast.error("Failed to complete lead conversion");
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);
      
      if (error) throw error;

      // Handle contact actions if requested
      if (contacts.length > 0 && (archiveContacts || inactivateContacts)) {
        const contactUpdates: any = {};
        if (inactivateContacts) contactUpdates.status = 'inactive';
        
        const { error: contactError } = await supabase
          .from("contacts")
          .update(contactUpdates)
          .eq("lead_id", id);
        
        if (contactError) console.error("Error updating contacts:", contactError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted successfully");
      navigate("/leads");
    },
    onError: (error) => {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("leads")
        .update({ 
          is_archived: true, 
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq("id", id);
      
      if (error) throw error;

      // Handle contact actions if requested
      if (contacts.length > 0 && (archiveContacts || inactivateContacts)) {
        const contactUpdates: any = {};
        if (inactivateContacts) contactUpdates.status = 'inactive';
        
        const { error: contactError } = await supabase
          .from("contacts")
          .update(contactUpdates)
          .eq("lead_id", id);
        
        if (contactError) console.error("Error updating contacts:", contactError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      toast.success("Lead archived successfully");
      navigate("/leads");
    },
    onError: (error) => {
      console.error("Error archiving lead:", error);
      toast.error("Failed to archive lead");
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      contacted: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      qualified: "bg-green-500/10 text-green-500 border-green-500/20",
      proposal: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      negotiation: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      lost: "bg-red-500/10 text-red-500 border-red-500/20",
    };
    return colors[status] || colors.new;
  };

  const primaryActions = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => setDialogOpen(true),
      variant: "outline" as const,
    },
    {
      label: "Create Quote",
      icon: <FileText className="h-4 w-4" />,
      onClick: () => setQuoteDialogOpen(true),
      variant: "outline" as const,
    },
    {
      label: "Convert to Customer",
      icon: <TrendingUp className="h-4 w-4" />,
      onClick: () => setCustomerDialogOpen(true),
      variant: "default" as const,
      show: !lead?.converted_to_customer_id && !lead?.is_archived,
    },
    {
      label: "Archive Lead",
      icon: <Archive className="h-4 w-4" />,
      onClick: () => {
        if (contacts.length > 0) {
          setPendingAction('archive');
          setContactActionDialogOpen(true);
        } else {
          setArchiveDialogOpen(true);
        }
      },
      variant: "outline" as const,
      show: !lead?.is_archived,
    },
    {
      label: "Delete Lead",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => {
        if (contacts.length > 0) {
          setPendingAction('delete');
          setContactActionDialogOpen(true);
        } else {
          setDeleteDialogOpen(true);
        }
      },
      variant: "destructive" as const,
    },
  ];

  const keyInfoSection = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-muted-foreground mb-1">Status</p>
        <Badge className={getStatusColor(lead?.status || "new")}>
          {lead?.status?.charAt(0).toUpperCase()}{lead?.status?.slice(1)}
        </Badge>
      </div>
      
      {lead?.company_name && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Company</p>
          <p className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {lead.company_name}
          </p>
        </div>
      )}

      {lead?.email && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Email</p>
          <a href={`mailto:${lead.email}`} className="text-sm font-medium flex items-center gap-2 hover:underline">
            <Mail className="h-4 w-4" />
            {lead.email}
          </a>
        </div>
      )}

      {lead?.phone && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Phone</p>
          <a href={`tel:${lead.phone}`} className="text-sm font-medium flex items-center gap-2 hover:underline">
            <Phone className="h-4 w-4" />
            {lead.phone}
          </a>
        </div>
      )}

      {lead?.assigned_user && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Assigned To</p>
          <p className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            {lead.assigned_user.full_name}
          </p>
        </div>
      )}

      {lead?.source && (
        <div>
          <p className="text-sm text-muted-foreground mb-1">Source</p>
          <p className="text-sm font-medium capitalize">{lead.source.replace('_', ' ')}</p>
        </div>
      )}

      {lead?.converted_to_customer_id && (
        <div className="md:col-span-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            Converted to Customer
          </Badge>
        </div>
      )}
    </div>
  );

  const tabs = [
    {
      value: "details",
      label: "Details",
      content: (
        <div className="space-y-6">
          {(lead?.address || lead?.city || lead?.state) && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </h3>
              <div className="text-sm">
                {lead.address && <div>{lead.address}</div>}
                {(lead.city || lead.state || lead.postcode) && (
                  <div>
                    {lead.city} {lead.state} {lead.postcode}
                  </div>
                )}
              </div>
            </div>
          )}

          {lead?.notes && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Notes</h3>
              <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}

          {lead?.created_at && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Created {format(new Date(lead.created_at), "PPP 'at' p")}
                {lead.created_user && ` by ${lead.created_user.full_name}`}
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      value: "contacts",
      label: "Contacts",
      badge: contacts.length,
      content: (
        <div className="space-y-4">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts linked to this lead</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                      {contact.position && (
                        <p className="text-sm text-muted-foreground">{contact.position}</p>
                      )}
                      {contact.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={
                      contact.status === "active" 
                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                        : contact.status === "lead"
                        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        : "bg-muted"
                    }>
                      {contact.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      value: "quotes",
      label: "Quotes",
      badge: quotes.length,
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setQuoteDialogOpen(true)} size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </div>
          
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotes for this lead</p>
          ) : (
            <div className="space-y-3">
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{quote.title}</p>
                      <p className="text-sm text-muted-foreground">{quote.quote_number}</p>
                      {quote.created_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(quote.created_at), "PPP")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${Number(quote.total_amount).toFixed(2)}</p>
                      <Badge variant="outline" className="mt-1">
                        {quote.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      value: "activities",
      label: "Activities",
      badge: activities.length,
      content: (
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities recorded</p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{activity.subject}</p>
                      <p className="text-sm text-muted-foreground capitalize">{activity.activity_type}</p>
                      {activity.description && (
                        <p className="text-sm mt-2">{activity.description}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.activity_date), "PPP")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      value: "tasks",
      label: "Tasks",
      content: (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CreateTaskButton
              linkedModule="lead"
              linkedRecordId={id || ""}
            />
          </div>
          <LinkedTasksList
            linkedModule="lead"
            linkedRecordId={id || ""}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <DocumentDetailLayout
        title={lead?.name || "Lead"}
        subtitle={lead?.company_name}
        backPath="/leads"
        primaryActions={primaryActions}
        customActions={<QuickActionsMenu leadId={id!} variant="outline" />}
        keyInfoSection={keyInfoSection}
        tabs={tabs}
        isLoading={isLoading}
      />

      <LeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leadId={id}
      />

      <QuoteHeaderDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        leadId={id}
      />

      <CustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        leadId={id}
        leadData={lead}
        onCustomerCreated={handleCustomerCreated}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lead? This action cannot be undone.
              Type "delete" below to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirm">Type "delete" to confirm</Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="delete"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmText("");
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate();
                setDeleteDialogOpen(false);
                setDeleteConfirmText("");
              }}
              disabled={deleteMutation.isPending || deleteConfirmText.toLowerCase() !== 'delete'}
            >
              Delete Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this lead? You can restore it later from the archived leads list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                archiveMutation.mutate();
                setArchiveDialogOpen(false);
              }}
              disabled={archiveMutation.isPending}
            >
              Archive Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactActionDialogOpen} onOpenChange={setContactActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Status</DialogTitle>
            <DialogDescription>
              This lead has {contacts.length} linked contact{contacts.length !== 1 ? 's' : ''}. What would you like to do with {contacts.length === 1 ? 'it' : 'them'}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="inactivate-contacts"
                checked={inactivateContacts}
                onCheckedChange={(checked) => setInactivateContacts(checked as boolean)}
              />
              <Label htmlFor="inactivate-contacts" className="cursor-pointer">
                Mark contact{contacts.length !== 1 ? 's' : ''} as inactive
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setContactActionDialogOpen(false);
              setArchiveContacts(false);
              setInactivateContacts(false);
            }}>
              Cancel
            </Button>
            <Button onClick={() => {
              setContactActionDialogOpen(false);
              if (pendingAction === 'delete') {
                setDeleteDialogOpen(true);
              } else if (pendingAction === 'archive') {
                setArchiveDialogOpen(true);
              }
            }}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
