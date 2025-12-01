import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface ProjectPurchaseOrdersTabProps {
  projectId: string;
  onCreatePO: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  received: "bg-info/10 text-info",
  rejected: "bg-destructive/10 text-destructive",
};

export default function ProjectPurchaseOrdersTab({ 
  projectId,
  onCreatePO 
}: ProjectPurchaseOrdersTabProps) {
  const navigate = useNavigate();

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ["project-purchase-orders", projectId],
    queryFn: async () => {
      // Get tenant_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) return [];

      // Use RPC function to get all POs, then filter
      const { data: pos, error } = await supabase
        .rpc('get_all_purchase_orders', { p_tenant_id: profile.tenant_id });

      if (error) throw error;
      
      // Filter for project_id match and fetch suppliers
      const filteredPos = pos?.filter(po => po.project_id === projectId) || [];
      
      if (filteredPos.length === 0) return [];

      // Fetch supplier details
      const supplierIds = [...new Set(filteredPos.map(po => po.supplier_id).filter(Boolean))];
      const { data: suppliers } = supplierIds.length > 0
        ? await supabase
            .from("suppliers")
            .select("id, name, abn")
            .in("id", supplierIds)
        : { data: [] };

      // Merge supplier data
      return filteredPos.map(po => ({
        ...po,
        suppliers: suppliers?.find(s => s.id === po.supplier_id)
      }));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Purchase Orders
        </CardTitle>
        <Button onClick={onCreatePO} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create PO
        </Button>
      </CardHeader>
      <CardContent>
        {!purchaseOrders || purchaseOrders.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No purchase orders linked to this project
            </p>
            <Button onClick={onCreatePO} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create First Purchase Order
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{po.suppliers?.name || "Unknown"}</TableCell>
                  <TableCell>
                    {po.po_date ? format(new Date(po.po_date), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[po.status] || ""}
                    >
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(po.total_amount || 0)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
