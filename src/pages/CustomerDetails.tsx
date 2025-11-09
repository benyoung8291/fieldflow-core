import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Plus, Phone, Mail, MapPin, Building2, FileText } from "lucide-react";
import CustomerDialog from "@/components/customers/CustomerDialog";
import ContactDialog from "@/components/customers/ContactDialog";

const mockCustomer = {
  id: "1",
  name: "Acme Corporation",
  tradingName: "Acme Corp",
  legalName: "Acme Corporation Pty Ltd",
  abn: "12 345 678 901",
  email: "accounts@acme.com",
  phone: "(02) 9123 4567",
  address: "123 Business St",
  city: "Sydney",
  state: "NSW",
  postcode: "2000",
  billingEmail: "billing@acme.com",
  billingPhone: "(02) 9123 4568",
  billingAddress: "123 Business St, Sydney NSW 2000",
  paymentTerms: 30,
  taxExempt: false,
  isActive: true,
  notes: "Important client - priority service",
};

const mockContacts = [
  {
    id: "1",
    firstName: "John",
    lastName: "Smith",
    position: "General Manager",
    email: "john.smith@acme.com",
    phone: "(02) 9123 4569",
    mobile: "0412 345 678",
    isPrimary: true,
  },
  {
    id: "2",
    firstName: "Sarah",
    lastName: "Johnson",
    position: "Facilities Manager",
    email: "sarah.j@acme.com",
    phone: "(02) 9123 4570",
    mobile: "0423 456 789",
    isPrimary: false,
  },
];

const mockSubAccounts = [
  {
    id: "2",
    name: "Acme Corp - North Branch",
    address: "456 North St, North Sydney NSW 2060",
    email: "north@acme.com",
    phone: "(02) 9234 5678",
  },
  {
    id: "3",
    name: "Acme Corp - West Branch",
    address: "789 West St, Parramatta NSW 2150",
    email: "west@acme.com",
    phone: "(02) 9345 6789",
  },
];

const mockServiceOrders = [
  {
    id: "1",
    orderNumber: "SO-2024001",
    title: "HVAC Installation",
    status: "completed",
    date: "2024-01-10",
    amount: "$2,500",
  },
  {
    id: "2",
    orderNumber: "SO-2024015",
    title: "Plumbing Maintenance",
    status: "in_progress",
    date: "2024-01-18",
    amount: "$850",
  },
  {
    id: "3",
    orderNumber: "SO-2024023",
    title: "Electrical Inspection",
    status: "scheduled",
    date: "2024-01-25",
    amount: "$450",
  },
];

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

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
              <h1 className="text-3xl font-bold text-foreground">{mockCustomer.name}</h1>
              <p className="text-muted-foreground mt-2">
                {mockCustomer.tradingName !== mockCustomer.name && (
                  <>Trading as {mockCustomer.tradingName} • </>
                )}
                ABN: {mockCustomer.abn}
              </p>
            </div>
            <Button onClick={() => setIsEditDialogOpen(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Customer
            </Button>
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">12</div>
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
                  <div className="text-2xl font-bold">{mockContacts.length}</div>
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
                  <div className="text-2xl font-bold">{mockSubAccounts.length}</div>
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
                  <div className="text-2xl font-bold">{mockCustomer.paymentTerms}</div>
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
                <TabsTrigger value="service-history">Service History</TabsTrigger>
                <TabsTrigger value="sub-accounts">Sub-Accounts</TabsTrigger>
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
                        <div className="font-medium">{mockCustomer.legalName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Trading Name</div>
                        <div className="font-medium">{mockCustomer.tradingName}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">ABN</div>
                        <div className="font-medium">{mockCustomer.abn}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <Badge className="bg-success/10 text-success">Active</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Contact Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Email</div>
                          <div className="font-medium">{mockCustomer.email}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Phone</div>
                          <div className="font-medium">{mockCustomer.phone}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Address</div>
                          <div className="font-medium">
                            {mockCustomer.address}<br />
                            {mockCustomer.city}, {mockCustomer.state} {mockCustomer.postcode}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Billing Information</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Billing Email</div>
                        <div className="font-medium">{mockCustomer.billingEmail}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Billing Phone</div>
                        <div className="font-medium">{mockCustomer.billingPhone}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Billing Address</div>
                        <div className="font-medium">{mockCustomer.billingAddress}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Tax Exempt</div>
                        <div className="font-medium">{mockCustomer.taxExempt ? "Yes" : "No"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">{mockCustomer.notes || "No notes available"}</p>
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
                <div className="space-y-3">
                  {mockContacts.map((contact) => (
                    <Card key={contact.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">
                                {contact.firstName} {contact.lastName}
                              </h4>
                              {contact.isPrimary && (
                                <Badge variant="secondary">Primary</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {contact.position}
                            </div>
                            <div className="grid gap-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                {contact.email}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {contact.phone}
                                {contact.mobile && ` • Mobile: ${contact.mobile}`}
                              </div>
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
              </TabsContent>

              <TabsContent value="service-history" className="space-y-4 mt-0">
                <h3 className="text-lg font-semibold">Service Order History</h3>
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
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockServiceOrders.map((order) => (
                        <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{order.orderNumber}</td>
                          <td className="py-3 px-4">{order.title}</td>
                          <td className="py-3 px-4">{order.date}</td>
                          <td className="py-3 px-4">
                            <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                              {order.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-medium">{order.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="sub-accounts" className="space-y-4 mt-0">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Sub-Accounts</h3>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Sub-Account
                  </Button>
                </div>
                <div className="space-y-3">
                  {mockSubAccounts.map((subAccount) => (
                    <Card key={subAccount.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold mb-2">{subAccount.name}</h4>
                            <div className="grid gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {subAccount.address}
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                {subAccount.email}
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {subAccount.phone}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <CustomerDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        customer={mockCustomer}
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
