import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Mail, Phone, MapPin, User, Building2, Archive } from "lucide-react";
import ContactManagementDialog from "@/components/contacts/ContactManagementDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

export default function Contacts() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const isMobile = useIsMobile();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", activeTab, showArchived],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select(`
          *,
          customer:customers(name),
          supplier:suppliers(name),
          assigned_user:profiles!contacts_assigned_to_fkey(id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      // Filter by archived status
      if (showArchived) {
        query = query.eq("status", "inactive");
      } else {
        query = query.neq("status", "inactive");
      }

      // Filter by contact type
      if (activeTab !== "all") {
        query = query.eq("contact_type", activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transform the data to add full_name
      return data?.map(contact => ({
        ...contact,
        assigned_user: contact.assigned_user ? {
          ...contact.assigned_user,
          full_name: `${contact.assigned_user.first_name || ''} ${contact.assigned_user.last_name || ''}`.trim()
        } : null
      })) || [];
    },
  });

  const filteredContacts = contacts?.filter((contact) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(searchLower) ||
      contact.last_name?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.company_name?.toLowerCase().includes(searchLower) ||
      contact.phone?.includes(searchQuery) ||
      contact.mobile?.includes(searchQuery)
    );
  });

  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedContact(null);
    setDialogOpen(true);
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

  const getContactTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      prospect: "bg-blue-500/10 text-blue-500",
      lead: "bg-yellow-500/10 text-yellow-500",
      customer_contact: "bg-green-500/10 text-green-500",
      supplier_contact: "bg-purple-500/10 text-purple-500",
      other: "bg-gray-500/10 text-gray-500",
    };
    return colors[type] || "bg-gray-500/10 text-gray-500";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-500/10 text-green-500",
      inactive: "bg-gray-500/10 text-gray-500",
      converted: "bg-blue-500/10 text-blue-500",
      unqualified: "bg-red-500/10 text-red-500",
    };
    return colors[status] || "bg-gray-500/10 text-gray-500";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Contacts</h1>
            <p className="text-muted-foreground">
              Manage your contacts throughout their entire lifecycle
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={showArchived ? "default" : "outline"} 
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="h-4 w-4 mr-2" />
              {showArchived ? "Show Active" : "Show Archived"}
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Contact
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts by name, email, phone, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs for filtering by contact type */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={isMobile ? "grid grid-cols-3 w-full" : ""}>
            <TabsTrigger value="all">All Contacts</TabsTrigger>
            <TabsTrigger value="prospect">Prospects</TabsTrigger>
            <TabsTrigger value="lead">Leads</TabsTrigger>
            <TabsTrigger value="customer_contact">Customer Contacts</TabsTrigger>
            <TabsTrigger value="supplier_contact">Supplier Contacts</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredContacts && filteredContacts.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredContacts.map((contact) => (
                  <Card
                    key={contact.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <CardContent className="p-6 space-y-4">
                      {/* Header with name and badges */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {contact.first_name} {contact.last_name}
                          </h3>
                          {contact.is_primary && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getContactTypeColor(contact.contact_type)}>
                            {getContactTypeLabel(contact.contact_type)}
                          </Badge>
                          <Badge className={getStatusColor(contact.status)}>
                            {contact.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Contact details */}
                      <div className="space-y-2 text-sm">
                        {contact.position && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4 shrink-0" />
                            <span className="line-clamp-1">{contact.position}</span>
                          </div>
                        )}
                        {contact.company_name && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4 shrink-0" />
                            <span className="line-clamp-1">{contact.company_name}</span>
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4 shrink-0" />
                            <span className="line-clamp-1">{contact.email}</span>
                          </div>
                        )}
                        {(contact.phone || contact.mobile) && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4 shrink-0" />
                            <span className="line-clamp-1">
                              {contact.mobile || contact.phone}
                            </span>
                          </div>
                        )}
                        {(contact.city || contact.state) && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0" />
                            <span className="line-clamp-1">
                              {[contact.city, contact.state].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Relationships */}
                      {(contact.customer || contact.supplier || contact.assigned_user) && (
                        <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
                          {contact.customer && (
                            <div>Customer: {contact.customer.name}</div>
                          )}
                          {contact.supplier && (
                            <div>Supplier: {contact.supplier.name}</div>
                          )}
                          {contact.assigned_user && (
                            <div>Assigned to: {contact.assigned_user.full_name}</div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "No contacts found matching your search."
                      : "No contacts yet. Create your first contact to get started."}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ContactManagementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={selectedContact}
      />
    </DashboardLayout>
  );
}
