import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, MapPin } from "lucide-react";
import SupplierDialog from "@/components/suppliers/SupplierDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function Suppliers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["suppliers"],
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

  const filteredVendors = vendors?.filter((vendor) => {
    const query = searchQuery.toLowerCase();
    return (
      vendor.name?.toLowerCase().includes(query) ||
      vendor.trading_name?.toLowerCase().includes(query) ||
      vendor.legal_company_name?.toLowerCase().includes(query) ||
      vendor.abn?.includes(query) ||
      vendor.email?.toLowerCase().includes(query)
    );
  });

  const handleCreateVendor = () => {
    setSelectedVendor(null);
    setDialogOpen(true);
  };

  const handleEditVendor = (vendor: any) => {
    setSelectedVendor(vendor);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Suppliers</h1>
            <p className="text-muted-foreground">Manage your suppliers</p>
          </div>
          <Button onClick={handleCreateVendor}>
            <Plus className="mr-2 h-4 w-4" />
            New Supplier
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers by name, ABN, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Vendors Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredVendors && filteredVendors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVendors.map((vendor) => (
              <Card
                key={vendor.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleEditVendor(vendor)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {vendor.trading_name || vendor.name}
                      </CardTitle>
                      {vendor.legal_company_name && vendor.legal_company_name !== vendor.trading_name && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {vendor.legal_company_name}
                        </p>
                      )}
                    </div>
                    <Badge variant={vendor.is_active ? "default" : "secondary"}>
                      {vendor.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vendor.abn && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">ABN:</span>
                      <span className="text-muted-foreground">{vendor.abn}</span>
                      {vendor.gst_registered && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          GST Registered
                        </Badge>
                      )}
                    </div>
                  )}
                  {vendor.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {(vendor.city || vendor.state) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {[vendor.city, vendor.state].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                  {vendor.payment_terms && (
                    <div className="flex items-center gap-2 text-sm pt-2 border-t">
                      <span className="font-medium">Payment Terms:</span>
                      <span className="text-muted-foreground">{vendor.payment_terms} days</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
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
    </DashboardLayout>
  );
}
