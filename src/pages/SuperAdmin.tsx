import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Building2, Users, DollarSign, Download } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import Papa from "papaparse";
import JSZip from "jszip";

export default function SuperAdmin() {
  const queryClient = useQueryClient();
  const { userRoles } = usePermissions();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    abn: "",
    email: "",
    phone: "",
    address: "",
    adminEmail: "",
    adminPassword: "",
    adminFirstName: "",
    adminLastName: "",
    subscriptionPlan: "standard",
    monthlyPrice: 0,
  });

  const isSuperAdmin = userRoles?.some((r) => r.role === "super_admin");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["super-admin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase.functions.invoke("create-tenant", {
        body: data,
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
      setIsCreateDialogOpen(false);
      setFormData({
        companyName: "",
        abn: "",
        email: "",
        phone: "",
        address: "",
        adminEmail: "",
        adminPassword: "",
        adminFirstName: "",
        adminLastName: "",
        subscriptionPlan: "standard",
        monthlyPrice: 0,
      });
      toast.success("Tenant created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create tenant");
    },
  });

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You do not have permission to access this area.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTenantMutation.mutate(formData);
  };

  const handleExport = async () => {
    if (!selectedTenantId) {
      toast.error("Please select a tenant");
      return;
    }

    setIsExporting(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke('export-tenant-data', {
        body: { tenantId: selectedTenantId }
      });

      if (error) throw error;
      if (!responseData?.success) throw new Error(responseData?.error || "Export failed");

      const { data, tenantName, exportedAt, stats } = responseData;
      
      toast.success(`Preparing ${stats.totalTables} tables for download (${stats.successCount} with data, ${stats.errorCount} skipped)...`);

      // Create zip file
      const zip = new JSZip();
      const timestamp = new Date(exportedAt).toISOString().split('T')[0];
      
      // Add each table as CSV to the zip
      Object.entries(data).forEach(([tableName, rows]: [string, any[]]) => {
        if (rows && rows.length > 0) {
          const csv = Papa.unparse(rows);
          zip.file(`${tableName}.csv`, csv);
        }
      });

      // Generate zip file
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Download the zip
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tenantName}_export_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Export completed! Downloaded ${tenantName}_export_${timestamp}.zip`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export tenant data");
    } finally {
      setIsExporting(false);
    }
  };

  const stats = tenants
    ? [
        {
          title: "Total Tenants",
          value: tenants.length,
          icon: Building2,
        },
        {
          title: "Active Subscriptions",
          value: tenants.filter((t) => t.is_active).length,
          icon: Users,
        },
        {
          title: "Monthly Revenue",
          value: `$${tenants.reduce((sum, t) => sum + (t.monthly_price || 0), 0).toFixed(2)}`,
          icon: DollarSign,
        },
      ]
    : [];

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage all tenant accounts</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Tenant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4">
                  <h3 className="font-semibold">Business Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="abn">ABN</Label>
                      <Input
                        id="abn"
                        value={formData.abn}
                        onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Company Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Admin User</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="adminFirstName">First Name *</Label>
                      <Input
                        id="adminFirstName"
                        value={formData.adminFirstName}
                        onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="adminLastName">Last Name</Label>
                      <Input
                        id="adminLastName"
                        value={formData.adminLastName}
                        onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="adminEmail">Email *</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="adminPassword">Password *</Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Min 12 characters, with uppercase, lowercase, number, and special character
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Subscription (Optional)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="subscriptionPlan">Plan</Label>
                      <Input
                        id="subscriptionPlan"
                        value={formData.subscriptionPlan}
                        onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthlyPrice">Monthly Price</Label>
                      <Input
                        id="monthlyPrice"
                        type="number"
                        step="0.01"
                        value={formData.monthlyPrice}
                        onChange={(e) => setFormData({ ...formData, monthlyPrice: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTenantMutation.isPending}>
                    {createTenantMutation.isPending ? "Creating..." : "Create Tenant"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading tenants...</p>
            ) : tenants && tenants.length > 0 ? (
              <div className="space-y-4">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{tenant.name}</h3>
                        <Badge variant={tenant.is_active ? "default" : "secondary"}>
                          {tenant.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{tenant.billing_email}</p>
                      {tenant.subscription_plan && (
                        <p className="text-sm">
                          Plan: {tenant.subscription_plan} 
                          {tenant.monthly_price && ` - $${tenant.monthly_price}/mo`}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created {new Date(tenant.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No tenants found</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-tenant">Select Tenant</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger id="export-tenant">
                  <SelectValue placeholder="Choose a tenant to export..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleExport} 
              disabled={!selectedTenantId || isExporting}
              className="w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? "Exporting..." : "Export All Tables"}
            </Button>
            {isExporting && (
              <p className="text-sm text-muted-foreground">
                Please wait while we export all tables. Multiple CSV files will be downloaded.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarProvider>
  );
}
