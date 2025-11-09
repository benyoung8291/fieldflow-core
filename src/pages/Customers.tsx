import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Building2, Users, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CustomerDialog from "@/components/customers/CustomerDialog";
import { useNavigate } from "react-router-dom";
import { usePresence } from "@/hooks/usePresence";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";

const mockCustomers = [
  {
    id: "1",
    name: "Acme Corporation",
    tradingName: "Acme Corp",
    legalName: "Acme Corporation Pty Ltd",
    abn: "12 345 678 901",
    email: "accounts@acme.com",
    phone: "(02) 9123 4567",
    city: "Sydney",
    state: "NSW",
    serviceOrders: 12,
    subAccounts: 3,
    isActive: true,
  },
  {
    id: "2",
    name: "Best Tech Industries",
    tradingName: "Best Tech",
    legalName: "Best Tech Industries Pty Ltd",
    abn: "23 456 789 012",
    email: "billing@besttech.com.au",
    phone: "(03) 8765 4321",
    city: "Melbourne",
    state: "VIC",
    serviceOrders: 8,
    subAccounts: 0,
    isActive: true,
  },
  {
    id: "3",
    name: "Metro Services Group",
    tradingName: "Metro Services",
    legalName: "Metro Services Group Pty Ltd",
    abn: "34 567 890 123",
    email: "admin@metro.com.au",
    phone: "(07) 3456 7890",
    city: "Brisbane",
    state: "QLD",
    serviceOrders: 15,
    subAccounts: 5,
    isActive: true,
  },
];

export default function Customers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const { onlineUsers, updateCursorPosition } = usePresence({
    page: "customers-list",
  });

  // Track mouse movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [updateCursorPosition]);

  const handleEdit = (customer: any) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const handleViewDetails = (customerId: string) => {
    navigate(`/customers/${customerId}`);
  };

  return (
    <DashboardLayout>
      <RemoteCursors users={onlineUsers} />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Customers</h1>
              <p className="text-muted-foreground mt-2">
                Manage customer accounts, contacts, and billing information
              </p>
            </div>
            <PresenceIndicator users={onlineUsers} />
          </div>
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Customer
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockCustomers.length}</div>
              <p className="text-xs text-muted-foreground">All active accounts</p>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sub-Accounts</CardTitle>
              <Users className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockCustomers.reduce((sum, c) => sum + c.subAccounts, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Linked accounts</p>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <FileText className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mockCustomers.reduce((sum, c) => sum + c.serviceOrders, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Service orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Search Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ABN, email, or phone..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>All Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      ABN
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Contact
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Location
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Orders
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Sub-Accounts
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(customer.id)}
                    >
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          {customer.tradingName !== customer.name && (
                            <div className="text-sm text-muted-foreground">
                              T/A {customer.tradingName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm">{customer.abn}</td>
                      <td className="py-4 px-4">
                        <div className="text-sm">{customer.email}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        {customer.city}, {customer.state}
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{customer.serviceOrders}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        {customer.subAccounts > 0 ? (
                          <Badge variant="secondary">{customer.subAccounts}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {customer.isActive ? (
                          <Badge className="bg-success/10 text-success">Active</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(customer);
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customer={selectedCustomer}
      />
    </DashboardLayout>
  );
}
