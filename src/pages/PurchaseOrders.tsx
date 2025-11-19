import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import { useNavigate } from "react-router-dom";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      // Get tenant_id first
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) {
        throw new Error("No tenant found");
      }

      // Use RPC function to bypass PostgREST schema cache
      const { data: pos, error: posError } = await supabase
        .rpc('get_all_purchase_orders', { p_tenant_id: profile.tenant_id });

      if (posError) {
        console.error("Purchase orders fetch error:", posError);
        throw posError;
      }

      // Fetch supplier details separately
      const supplierIds = pos && pos.length > 0 
        ? [...new Set(pos.map(po => po.supplier_id).filter(Boolean))]
        : [];
      
      const { data: suppliers } = supplierIds.length > 0 
        ? await supabase
            .from("suppliers")
            .select("id, name, gst_registered")
            .in("id", supplierIds)
        : { data: [] };

      // Fetch creator details separately
      const creatorIds = pos && pos.length > 0
        ? [...new Set(pos.map(po => po.created_by).filter(Boolean))]
        : [];
      
      const { data: creators } = creatorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", creatorIds)
        : { data: [] };

      // Merge the data
      const enrichedPos = pos?.map(po => ({
        ...po,
        suppliers: suppliers?.find(s => s.id === po.supplier_id),
        profiles: creators?.find(c => c.id === po.created_by)
      }));

      setPurchaseOrders(enrichedPos || []);
    } catch (error: any) {
      console.error("Failed to load purchase orders:", error);
      toast.error("Failed to load purchase orders: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const filteredPOs = purchaseOrders.filter((po) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      po.po_number?.toLowerCase().includes(searchLower) ||
      po.suppliers?.name?.toLowerCase().includes(searchLower) ||
      po.status?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-500",
      approved: "bg-blue-500",
      sent: "bg-purple-500",
      partially_received: "bg-yellow-500",
      fully_received: "bg-green-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const handleEdit = (po: any) => {
    setSelectedPO(po);
    setDialogOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedPO(null);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage purchase orders and supplier invoices</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase Order
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search purchase orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading purchase orders...</div>
      ) : filteredPOs.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No purchase orders found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? "Try adjusting your search" : "Create your first purchase order to get started"}
          </p>
          {!searchTerm && (
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Purchase Order
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPOs.map((po) => (
            <Card
              key={po.id}
              className="p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/purchase-orders/${po.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {po.po_number || "Draft PO"}
                    </h3>
                    <Badge className={getStatusColor(po.status)}>
                      {po.status?.replace("_", " ").toUpperCase()}
                    </Badge>
                    {po.suppliers?.gst_registered && (
                      <Badge variant="outline">GST Registered</Badge>
                    )}
                  </div>
                  
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Supplier:</span>
                        <span className="ml-2 font-medium">{po.suppliers?.name}</span>
                      </div>
                    <div>
                      <span className="text-muted-foreground">PO Date:</span>
                      <span className="ml-2">{new Date(po.po_date).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <span className="ml-2 font-semibold">${po.total_amount?.toFixed(2)}</span>
                    </div>
                    {po.delivery_date && (
                      <div>
                        <span className="text-muted-foreground">Delivery:</span>
                        <span className="ml-2">{new Date(po.delivery_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {po.notes && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                      {po.notes}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PurchaseOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        purchaseOrder={selectedPO}
        onSuccess={fetchPurchaseOrders}
      />
      </div>
    </DashboardLayout>
  );
}
