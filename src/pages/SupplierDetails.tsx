import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Edit, Plus, Phone, Mail, MapPin, 
  FileText, Building2, Users, Briefcase, CheckCircle2, XCircle
} from "lucide-react";
import SupplierDialog from "@/components/suppliers/SupplierDialog";
import ContactManagementDialog from "@/components/contacts/ContactManagementDialog";
import SupplierLinkedDocuments from "@/components/suppliers/SupplierLinkedDocuments";
import AuditDrawer from "@/components/audit/AuditDrawer";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import { usePresenceSystem } from "@/hooks/usePresenceSystem";

export default function SupplierDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const { data: supplier, isLoading: supplierLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Track presence on this supplier
  usePresenceSystem({
    trackPresence: true,
    documentId: id,
    documentType: "suppliers",
    documentName: supplier?.name ? `Supplier: ${supplier.name}` : undefined,
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["supplier-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("supplier_id", id)
        .order("is_primary", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: purchaseOrdersCount = 0 } = useQuery({
    queryKey: ["supplier-po-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("purchase_orders")
        .select("*", { count: 'exact', head: true })
        .eq("supplier_id", id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  const { data: apInvoicesCount = 0 } = useQuery({
    queryKey: ["supplier-ap-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ap_invoices")
        .select("*", { count: 'exact', head: true })
        .eq("supplier_id", id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });

  const subcontractorWorkers = contacts.filter(c => c.is_assignable_worker);

  if (supplierLoading) {
    return <DashboardLayout><div className="p-8">Loading...</div></DashboardLayout>;
  }

  if (!supplier) {
    return <DashboardLayout><div className="p-8">Supplier not found</div></DashboardLayout>;
  }

  const handleEditContact = (contact: any) => {
    setSelectedContact(contact);
    setIsContactDialogOpen(true);
  };

  const handleAddContact = () => {
    setSelectedContact(null);
    setIsContactDialogOpen(true);
  };

  const handleContactDialogClose = () => {
    setIsContactDialogOpen(false);
    setSelectedContact(null);
    refetchContacts();
  };

  return (
    <DashboardLayout>
      <AuditDrawer 
        tableName="suppliers" 
        recordId={id!} 
        recordTitle={supplier.name}
      />
      
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/suppliers")}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Suppliers
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{supplier.trading_name || supplier.name}</h1>
              <p className="text-muted-foreground mt-2">
                {supplier.legal_company_name && supplier.legal_company_name !== (supplier.trading_name || supplier.name) && (
                  <>{supplier.legal_company_name} • </>
                )}
                {supplier.abn && <>ABN: {supplier.abn}</>}
              </p>
            </div>
            <div className="flex gap-2">
              <CreateTaskButton
                linkedModule="supplier"
                linkedRecordId={id!}
                variant="outline"
              />
              <Button onClick={() => setIsEditDialogOpen(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit Supplier
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
                  <div className="text-2xl font-bold">{purchaseOrdersCount}</div>
                  <div className="text-xs text-muted-foreground">Purchase Orders</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-warning" />
                <div>
                  <div className="text-2xl font-bold">{apInvoicesCount}</div>
                  <div className="text-xs text-muted-foreground">AP Invoices</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-success" />
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
                <Briefcase className="h-8 w-8 text-violet-500" />
                <div>
                  <div className="text-2xl font-bold">{subcontractorWorkers.length}</div>
                  <div className="text-xs text-muted-foreground">Subcontractor Workers</div>
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
                <TabsTrigger value="linked-documents">Linked Documents</TabsTrigger>
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
                        <div className="font-medium">{supplier.legal_company_name || supplier.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Trading Name</div>
                        <div className="font-medium">{supplier.trading_name || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">ABN</div>
                        <div className="space-y-2">
                          <div className="font-medium">{supplier.abn || "-"}</div>
                          {supplier.abn && (
                            <>
                              {supplier.abn_validation_status === 'valid' && (
                                <Badge variant="outline" className="bg-success/10 text-success">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Validated
                                </Badge>
                              )}
                              {supplier.abn_validation_status === 'invalid' && (
                                <Badge variant="destructive">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Invalid ABN
                                </Badge>
                              )}
                              {supplier.abn_validation_status === 'pending' && (
                                <Badge variant="outline" className="bg-warning/10 text-warning">
                                  Validation Pending
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">GST Status</div>
                        {supplier.gst_registered ? (
                          <Badge variant="outline" className="bg-success/10 text-success">
                            GST Registered
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning">
                            Not GST Registered
                          </Badge>
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <Badge className={supplier.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                          {supplier.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Contact Information</h3>
                    <div className="space-y-3">
                      {supplier.email && (
                        <div className="flex items-start gap-2">
                          <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Email</div>
                            <div className="font-medium">{supplier.email}</div>
                          </div>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-start gap-2">
                          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Phone</div>
                            <div className="font-medium">{supplier.phone}</div>
                          </div>
                        </div>
                      )}
                      {supplier.mobile && (
                        <div className="flex items-start gap-2">
                          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Mobile</div>
                            <div className="font-medium">{supplier.mobile}</div>
                          </div>
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Address</div>
                            <div className="font-medium">
                              {supplier.address}
                              {(supplier.city || supplier.state || supplier.postcode) && (
                                <>
                                  <br />
                                  {[supplier.city, supplier.state, supplier.postcode].filter(Boolean).join(", ")}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Payment Information</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Payment Terms</div>
                        <div className="font-medium">{supplier.payment_terms ? `${supplier.payment_terms} days` : "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Default Account Code</div>
                        <div className="font-medium">{supplier.default_account_code || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Default Sub-Account</div>
                        <div className="font-medium">{supplier.default_sub_account || "-"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Integration Status */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Integration Status</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Acumatica Supplier ID</div>
                        <div className="font-medium">{supplier.acumatica_supplier_id || "-"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Xero Contact ID</div>
                        <div className="font-medium">{supplier.xero_contact_id || "-"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-4 md:col-span-2">
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">{supplier.notes || "No notes available"}</p>
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
                      <Card 
                        key={contact.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleEditContact(contact)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {contact.first_name} {contact.last_name}
                                </span>
                                {contact.is_primary && (
                                  <Badge variant="outline" className="text-xs">Primary</Badge>
                                )}
                                {contact.is_assignable_worker && (
                                  <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-xs">
                                    <Briefcase className="h-3 w-3 mr-1" />
                                    Subcontractor Worker
                                    {contact.worker_state && ` (${contact.worker_state})`}
                                  </Badge>
                                )}
                              </div>
                              {contact.position && (
                                <div className="text-sm text-muted-foreground">{contact.position}</div>
                              )}
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              {contact.email && <div>{contact.email}</div>}
                              {contact.phone && <div>{contact.phone}</div>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="linked-documents" className="mt-0">
                <SupplierLinkedDocuments supplierId={id!} />
              </TabsContent>

              <TabsContent value="tasks" className="mt-0">
                <LinkedTasksList linkedModule="supplier" linkedRecordId={id!} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <SupplierDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        vendor={supplier}
      />

      <ContactManagementDialog
        open={isContactDialogOpen}
        onOpenChange={handleContactDialogClose}
        contact={selectedContact}
        defaultSupplierId={id}
      />
    </DashboardLayout>
  );
}
