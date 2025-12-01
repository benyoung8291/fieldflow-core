import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Archive, ArrowUpDown } from "lucide-react";
import ContactManagementDialog from "@/components/contacts/ContactManagementDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { usePagination } from "@/hooks/usePagination";
import { QuickActionsMenu } from "@/components/quick-actions/QuickActionsMenu";
import { PermissionButton } from "@/components/permissions";

export default function Contacts() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const isMobile = useIsMobile();
  const pagination = usePagination({ initialPageSize: 50 });

  const { data: contactsResponse, isLoading } = useQuery({
    queryKey: ["contacts", activeTab, showArchived, searchQuery, pagination.currentPage, pagination.pageSize, sortColumn, sortDirection],
    queryFn: async () => {
      const { from, to } = pagination.getRange();
      let query = supabase
        .from("contacts")
        .select(`
          *,
          customer:customers(name),
          supplier:suppliers(name),
          assigned_user:profiles!contacts_assigned_to_fkey(id, first_name, last_name)
        `, { count: 'exact' })
        .order(sortColumn, { ascending: sortDirection === "asc" });

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

      // Apply search filter across all records
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        query = query.or(`first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,company_name.ilike.%${searchLower}%,phone.ilike.%${searchQuery}%,mobile.ilike.%${searchQuery}%`);
      }

      // Apply pagination after filters
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      // Transform the data to add full_name
      const transformedData = data?.map(contact => ({
        ...contact,
        assigned_user: contact.assigned_user ? {
          ...contact.assigned_user,
          full_name: `${contact.assigned_user.first_name || ''} ${contact.assigned_user.last_name || ''}`.trim()
        } : null
      })) || [];
      
      return { data: transformedData, count: count || 0 };
    },
  });
  
  const contacts = contactsResponse?.data || [];
  const totalCount = contactsResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedContact(null);
    setDialogOpen(true);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    pagination.resetPage();
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
            <PermissionButton
              module="contacts"
              permission="create"
              onClick={handleAdd}
              hideIfNoPermission={true}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Contact
            </PermissionButton>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts by name, email, phone, or company..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              pagination.resetPage();
            }}
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
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : contacts && contacts.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("first_name")}
                          className="hover:bg-transparent"
                        >
                          Name
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("contact_type")}
                          className="hover:bg-transparent"
                        >
                          Type
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("status")}
                          className="hover:bg-transparent"
                        >
                          Status
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSort("company_name")}
                          className="hover:bg-transparent"
                        >
                          Company
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow 
                        key={contact.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {contact.first_name} {contact.last_name}
                            {contact.is_primary && (
                              <Badge variant="outline" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          {contact.position && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {contact.position}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getContactTypeColor(contact.contact_type)}>
                            {getContactTypeLabel(contact.contact_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(contact.status)}>
                            {contact.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{contact.company_name || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.email || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.mobile || contact.phone || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {[contact.city, contact.state].filter(Boolean).join(", ") || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="border rounded-lg p-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No contacts found matching your search."
                    : "No contacts yet. Create your first contact to get started."}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} contacts
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => pagination.prevPage()} disabled={pagination.currentPage === 0}>
                Previous
              </Button>
              <div className="text-sm">Page {pagination.currentPage + 1} of {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => pagination.nextPage()} disabled={pagination.currentPage >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ContactManagementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={selectedContact}
      />
    </DashboardLayout>
  );
}
