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

interface ServiceOrderPurchaseOrdersTabProps {
  serviceOrderId: string;
  onCreatePO: () => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  received: "bg-info/10 text-info",
  rejected: "bg-destructive/10 text-destructive",
};

export default function ServiceOrderPurchaseOrdersTab({ 
  serviceOrderId,
  onCreatePO 
}: ServiceOrderPurchaseOrdersTabProps) {
  const navigate = useNavigate();

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ["service-order-purchase-orders", serviceOrderId],
    queryFn: async () => {
      // Fetch all POs and filter client-side to bypass PostgREST schema cache issues
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(name, abn)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter client-side for service_order_id match
      return data?.filter(po => po.service_order_id === serviceOrderId) || [];
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
              No purchase orders linked to this service order
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
                  <TableCell>{po.suppliers?.name || "N/A"}</TableCell>
                  <TableCell>{format(new Date(po.po_date), "PP")}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[po.status] || statusColors.draft}>
                      {po.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${po.total_amount?.toFixed(2) || "0.00"}
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