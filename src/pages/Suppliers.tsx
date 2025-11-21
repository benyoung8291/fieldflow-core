import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, MapPin, ArrowUpDown, Filter, Upload, Download, FileUp, FileDown, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import SupplierDialog from "@/components/suppliers/SupplierDialog";
import { SupplierImportDialog } from "@/components/suppliers/SupplierImportDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SortField = "name" | "abn" | "created_at" | "payment_terms";
type SortOrder = "asc" | "desc";

export default function Suppliers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gstFilter, setGstFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [validatingAbns, setValidatingAbns] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const filteredAndSortedVendors = vendors
    ?.filter((vendor) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        vendor.name?.toLowerCase().includes(query) ||
        vendor.trading_name?.toLowerCase().includes(query) ||
        vendor.legal_company_name?.toLowerCase().includes(query) ||
        vendor.abn?.includes(query) ||
        vendor.email?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && vendor.is_active) ||
        (statusFilter === "inactive" && !vendor.is_active);

      const matchesGst =
        gstFilter === "all" ||
        (gstFilter === "registered" && vendor.gst_registered) ||
        (gstFilter === "not_registered" && !vendor.gst_registered);

      return matchesSearch && matchesStatus && matchesGst;
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Convert to strings for comparison
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const handleCreateVendor = () => {
    setSelectedVendor(null);
    setDialogOpen(true);
  };

  const handleEditVendor = (vendor: any) => {
    setSelectedVendor(vendor);
    setDialogOpen(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleImportFromAccounting = async (provider: 'xero' | 'acumatica') => {
    setSyncing(true);
    try {
      const functionName = provider === 'xero' ? 'fetch-xero-suppliers' : 'fetch-acumatica-vendors';
      
      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;
      
      if (data?.suppliers && data.suppliers.length > 0) {
        // Import suppliers
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (!profile?.tenant_id) throw new Error("No tenant found");

        for (const supplier of data.suppliers) {
          const supplierData = {
            tenant_id: profile.tenant_id,
            name: supplier.name,
            trading_name: supplier.tradingName || null,
            abn: supplier.abn || null,
            email: supplier.email || null,
            phone: supplier.phone || null,
            address: supplier.address || null,
            is_active: true,
            [provider === 'xero' ? 'xero_contact_id' : 'xero_contact_id']: supplier.id,
          };

          await supabase.from("suppliers").upsert([supplierData], {
            onConflict: provider === 'xero' ? 'xero_contact_id' : 'xero_contact_id',
          });
        }

        await queryClient.invalidateQueries({ queryKey: ["vendors"] });
        
        toast({
          title: "Import complete",
          description: `Imported ${data.suppliers.length} suppliers from ${provider === 'xero' ? 'Xero' : 'Acumatica'}`,
        });
      } else {
        toast({
          title: "No suppliers found",
          description: `No suppliers found in ${provider === 'xero' ? 'Xero' : 'Acumatica'}`,
        });
      }
    } catch (error) {
      console.error("Error importing suppliers:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleValidateAllAbns = async () => {
    setValidatingAbns(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-all-supplier-abns');

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["vendors"] });

      const results = data.results;
      toast({
        title: "ABN Validation Complete",
        description: `Validated ${results.validated} suppliers successfully. ${results.failed} failed. ${results.skipped} skipped.`,
      });
    } catch (error) {
      console.error("Error validating ABNs:", error);
      toast({
        title: "Validation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setValidatingAbns(false);
    }
  };

  const handleExportToAccounting = async (provider: 'xero' | 'acumatica') => {
    setSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Get integration settings
      const { data: integration } = await supabase
        .from("accounting_integrations")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", provider)
        .single();

      if (!integration) {
        toast({
          title: "Integration not configured",
          description: `Please configure ${provider === 'xero' ? 'Xero' : 'Acumatica'} integration in settings`,
          variant: "destructive",
        });
        return;
      }

      // Get all suppliers without external ID
      const { data: suppliersToExport } = await supabase
        .from("suppliers")
        .select("id")
        .eq("tenant_id", profile.tenant_id)
        .is("xero_contact_id", null);

      if (!suppliersToExport || suppliersToExport.length === 0) {
        toast({
          title: "No suppliers to export",
          description: "All suppliers are already synced",
        });
        return;
      }

      const functionName = provider === 'xero' ? 'export-to-xero-suppliers' : 'export-to-acumatica-vendors';
      
      const payload = provider === 'xero' 
        ? { accountIds: suppliersToExport.map(s => s.id) }
        : {
            supplierIds: suppliersToExport.map(s => s.id),
            instanceUrl: integration.acumatica_instance_url,
            companyName: integration.acumatica_company_name,
          };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["vendors"] });

      toast({
        title: "Export complete",
        description: `Exported ${suppliersToExport.length} suppliers to ${provider === 'xero' ? 'Xero' : 'Acumatica'}`,
      });
    } catch (error) {
      console.error("Error exporting suppliers:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Suppliers</h1>
            <p className="text-muted-foreground">Manage your suppliers</p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={syncing}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Import From</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  <FileUp className="mr-2 h-4 w-4" />
                  CSV File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleImportFromAccounting('xero')}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Xero
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleImportFromAccounting('acumatica')}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Acumatica
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={syncing}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export To</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExportToAccounting('xero')}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Xero
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportToAccounting('acumatica')}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Acumatica
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="outline" 
              onClick={handleValidateAllAbns}
              disabled={validatingAbns}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {validatingAbns ? "Validating..." : "Validate All ABNs"}
            </Button>

            <Button onClick={handleCreateVendor}>
              <Plus className="mr-2 h-4 w-4" />
              New Supplier
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers by name, ABN, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={gstFilter} onValueChange={setGstFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="GST Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All GST</SelectItem>
                    <SelectItem value="registered">GST Registered</SelectItem>
                    <SelectItem value="not_registered">Not Registered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suppliers Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : filteredAndSortedVendors && filteredAndSortedVendors.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton field="name">Supplier Name</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="abn">ABN</SortButton>
                    </TableHead>
                    <TableHead>ABN Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>
                      <SortButton field="payment_terms">Payment Terms</SortButton>
                    </TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedVendors.map((vendor) => (
                    <TableRow
                      key={vendor.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEditVendor(vendor)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {vendor.trading_name || vendor.name}
                          </div>
                          {vendor.legal_company_name && 
                           vendor.legal_company_name !== vendor.trading_name && (
                            <div className="text-sm text-muted-foreground">
                              {vendor.legal_company_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {vendor.abn && (
                            <span className="text-sm">{vendor.abn}</span>
                          )}
                          {vendor.gst_registered && (
                            <Badge variant="outline" className="w-fit text-xs border-green-600 text-green-600">
                              GST Registered
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendor.abn && (
                          <div>
                            {vendor.abn_validation_status === 'valid' && (
                              <Badge variant="outline" className="border-green-600 text-green-600">
                                Valid
                              </Badge>
                            )}
                            {vendor.abn_validation_status === 'invalid' && (
                              <Badge variant="outline" className="border-red-600 text-red-600">
                                Invalid
                              </Badge>
                            )}
                            {vendor.abn_validation_status === 'pending' && (
                              <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                                Validating...
                              </Badge>
                            )}
                            {vendor.abn_validation_status === 'needs_review' && (
                              <Badge variant="outline" className="border-orange-600 text-orange-600">
                                Needs Review
                              </Badge>
                            )}
                            {!vendor.abn_validation_status && (
                              <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                                Not Checked
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {vendor.email && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[200px]">{vendor.email}</span>
                            </div>
                          )}
                          {vendor.phone && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{vendor.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(vendor.city || vendor.state) && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>
                              {[vendor.city, vendor.state].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.payment_terms && (
                          <span className="text-sm">{vendor.payment_terms} days</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={vendor.is_active ? "default" : "secondary"}>
                          {vendor.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "No suppliers found matching your search" : "No suppliers yet"}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreateVendor}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Supplier
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendor={selectedVendor}
      />
      
      <SupplierImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => queryClient.invalidateQueries({ queryKey: ["vendors"] })}
      />
    </DashboardLayout>
  );
}
