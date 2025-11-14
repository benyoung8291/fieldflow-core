import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Plus, Phone, Mail, MapPin, Building2, FileText } from "lucide-react";
import CustomerDialog from "@/components/customers/CustomerDialog";
import ContactDialog from "@/components/customers/ContactDialog";
import CustomerLocationsTab from "@/components/customers/CustomerLocationsTab";
import AuditDrawer from "@/components/audit/AuditDrawer";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  draft: "Waiting",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isSubAccountDialogOpen, setIsSubAccountDialogOpen] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session?.user?.id)
        .single();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["customer-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("customer_id", id)
        .order("is_primary", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["customer-service-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: subAccounts = [] } = useQuery({
    queryKey: ["customer-sub-accounts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("parent_customer_id", id)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  if (customerLoading) {
    return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  }

  if (!customer) {
    return <DashboardLayout><div className="p-8">Customer not found</div></DashboardLayout>;
  }

  const handleEditContact = (contact: any) => {
    setSelectedContact(contact);
    setIsContactDialogOpen(true);
  };

  const handleAddContact = () => {
    setSelectedContact(null);
    setIsContactDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <AuditDrawer 
        tableName="customers" 
        recordId={id!} 
        recordTitle={customer.name}
      />
      
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/customers")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{customer.name}</h1>
              <p className="text-muted-foreground mt-2">
                {customer.trading_name && customer.trading_name !== customer.name && (
                  <>Trading as {customer.trading_name} • </>
                )}
                {customer.abn && <>ABN: {customer.abn}</>}
              </p>
            </div>
            <div className="flex gap-2">
              <CreateTaskButton
                linkedModule="customer"
                linkedRecordId={id!}
                variant="outline"
              />
              <Button onClick={() => setIsEditDialogOpen(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit Customer
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{serviceOrders.length}</div>
                  <div className="text-xs text-muted-foreground">Service Orders</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-success" />
                <div>
                  <div className="text-2xl font-bold">{contacts.length}</div>
                  <div className="text-xs text-muted-foreground">Contacts</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-info" />
                <div>
                  <div className="text-2xl font-bold">{subAccounts.length}</div>
                  <div className="text-xs text-muted-foreground">Sub-Accounts</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-warning" />
                <div>
                  <div className="text-2xl font-bold">{customer.payment_terms || 30}</div>
                  <div className="text-xs text-muted-foreground">Payment Terms (days)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="shadow-md">
          <Tabs defaultValue="overview" className="w-full">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
                <TabsTrigger value="locations">Locations</TabsTrigger>
                <TabsTrigger value="service-history">Service History</TabsTrigger>
                <TabsTrigger value="sub-accounts">Sub-Accounts</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="overview" className="space-y-6 mt-0">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Company Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Company Information</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Legal Name</div>
                        <div className="font-medium">{customer.legal_company_name || customer.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Trading Name</div>
                        <div className="font-medium">{customer.trading_name || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">ABN</div>
                        <div className="font-medium">{customer.abn || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <Badge className={customer.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                          {customer.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Contact Information</h3>
                    <div className="space-y-3">
                      {customer.email && (
                        <div className="flex items-start gap-2">
                          <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Email</div>
                            <div className="font-medium">{customer.email}</div>
                          </div>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-start gap-2">
                          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Phone</div>
                            <div className="font-medium">{customer.phone}</div>
                          </div>
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Address</div>
                            <div className="font-medium">
                              {customer.address}
                              {(customer.city || customer.state || customer.postcode) && (
                                <>
                                  <br />
                                  {[customer.city, customer.state, customer.postcode].filter(Boolean).join(", ")}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Billing Information</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Billing Email</div>
                        <div className="font-medium">{customer.billing_email || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Billing Phone</div>
                        <div className="font-medium">{customer.billing_phone || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Billing Address</div>
                        <div className="font-medium">{customer.billing_address || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Tax Exempt</div>
                        <div className="font-medium">{customer.tax_exempt ? "Yes" : "No"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">{customer.notes || "No notes available"}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4 mt-0">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Contact List</h3>
                  <Button onClick={handleAddContact} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Contact
                  </Button>
                </div>
                {contacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No contacts found. Add a contact to get started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contacts.map((contact) => (
                      <Card key={contact.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">
                                  {contact.first_name} {contact.last_name}
                                </h4>
                                {contact.is_primary && (
                                  <Badge variant="secondary">Primary</Badge>
                                )}
                              </div>
                              {contact.position && (
                                <div className="text-sm text-muted-foreground mb-2">
                                  {contact.position}
                                </div>
                              )}
                              <div className="grid gap-2">
                                {contact.email && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    {contact.email}
                                  </div>
                                )}
                                {(contact.phone || contact.mobile) && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {contact.phone}
                                    {contact.mobile && ` • Mobile: ${contact.mobile}`}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditContact(contact)}
                            >
                              Edit
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="locations" className="space-y-4 mt-0">
                {profile?.tenant_id && (
                  <CustomerLocationsTab customerId={id!} tenantId={profile.tenant_id} />
                )}
              </TabsContent>

              <TabsContent value="service-history" className="space-y-4 mt-0">
                <h3 className="text-lg font-semibold">Service Order History</h3>
                {serviceOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No service orders found for this customer.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                            Order #
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                            Title
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                            Date
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceOrders.map((order) => (
                          <tr key={order.id} className="border-b border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigate(`/service-orders/${order.id}`)}>
                            <td className="py-3 px-4 font-medium">{order.order_number || order.id.slice(0, 8)}</td>
                            <td className="py-3 px-4">{order.title || "-"}</td>
                            <td className="py-3 px-4">{order.created_at ? new Date(order.created_at).toLocaleDateString() : "-"}</td>
                            <td className="py-3 px-4">
                              <Badge className={statusColors[order.status as keyof typeof statusColors] || statusColors.draft}>
                                {statusLabels[order.status as keyof typeof statusLabels] || order.status?.replace('_', ' ') || "Waiting"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sub-accounts" className="space-y-4 mt-0">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Sub-Accounts</h3>
                  <Button onClick={() => setIsSubAccountDialogOpen(true)} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Sub-Account
                  </Button>
                </div>
                {subAccounts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sub-accounts found for this customer.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subAccounts.map((account) => (
                    <Card key={account.id} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/customers/${account.id}`)}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold mb-1">{account.name}</h4>
                            {account.address && (
                              <div className="text-sm text-muted-foreground mb-2">
                                {account.address}
                                {(account.city || account.state || account.postcode) && (
                                  <>, {[account.city, account.state, account.postcode].filter(Boolean).join(", ")}</>
                                )}
                              </div>
                            )}
                            <div className="flex gap-4 text-sm">
                              {account.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {account.email}
                                </div>
                              )}
                              {account.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {account.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="mt-0">
                <LinkedTasksList linkedModule="customer" linkedRecordId={id!} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <CustomerDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        customer={customer}
      />

      <CustomerDialog
        open={isSubAccountDialogOpen}
        onOpenChange={setIsSubAccountDialogOpen}
        parentCustomerId={id}
      />

      <ContactDialog
        open={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
        contact={selectedContact}
        customerId={id!}
      />
    </DashboardLayout>
  );
}
