import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import ProjectChangeOrderDialog from "./ProjectChangeOrderDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface ProjectChangeOrdersTabProps {
  projectId: string;
}

export default function ProjectChangeOrdersTab({ projectId }: ProjectChangeOrdersTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChangeOrder, setSelectedChangeOrder] = useState<any>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [changeOrderToApprove, setChangeOrderToApprove] = useState<any>(null);

  const { data: changeOrders, isLoading, refetch } = useQuery({
    queryKey: ["project-change-orders", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_change_orders")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch user profiles separately
      const ordersWithProfiles = await Promise.all((data || []).map(async (order: any) => {
        let requestedByProfile = null;
        let approvedByProfile = null;
        
        if (order.requested_by) {
          const { data: reqProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", order.requested_by)
            .single();
          requestedByProfile = reqProfile;
        }
        
        if (order.approved_by) {
          const { data: appProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", order.approved_by)
            .single();
          approvedByProfile = appProfile;
        }
        
        return {
          ...order,
          requested_by_profile: requestedByProfile,
          approved_by_profile: approvedByProfile,
        };
      }));
      
      return ordersWithProfiles;
    },
  });

  const handleApprove = async () => {
    if (!changeOrderToApprove) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("project_change_orders")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", changeOrderToApprove.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Change order approved successfully",
      });

      refetch();
      setApprovalDialogOpen(false);
      setChangeOrderToApprove(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (changeOrderId: string) => {
    try {
      const { error } = await supabase
        .from("project_change_orders")
        .update({ status: "rejected" })
        .eq("id", changeOrderId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Change order rejected",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const statusConfig = {
    draft: { color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: FileText },
    pending: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: Clock },
    approved: { color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle },
    rejected: { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle },
    completed: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: CheckCircle },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading change orders...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Change Orders</h3>
            <p className="text-sm text-muted-foreground">
              Manage project scope and budget changes
            </p>
          </div>
          <Button
            onClick={() => {
              setSelectedChangeOrder(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Change Order
          </Button>
        </div>

        {!changeOrders || changeOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No change orders yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {changeOrders.map((co) => {
              const StatusIcon = statusConfig[co.status as keyof typeof statusConfig]?.icon || FileText;
              return (
                <Card
                  key={co.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedChangeOrder(co);
                    setDialogOpen(true);
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{co.title}</CardTitle>
                          <Badge
                            variant="outline"
                            className={statusConfig[co.status as keyof typeof statusConfig]?.color}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {co.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {co.change_order_number} • Created {format(new Date(co.created_at), "MMM d, yyyy")}
                        </p>
                        {co.description && (
                          <p className="text-sm text-muted-foreground mt-2">{co.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${co.budget_impact >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {co.budget_impact >= 0 ? '+' : ''}{formatCurrency(co.budget_impact)}
                        </div>
                        {co.schedule_impact_days > 0 && (
                          <p className="text-sm text-muted-foreground">
                            +{co.schedule_impact_days} days
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">
                          Requested by: {co.requested_by_profile?.first_name} {co.requested_by_profile?.last_name}
                        </p>
                        {co.approved_by_profile && (
                          <p className="text-muted-foreground">
                            Approved by: {co.approved_by_profile.first_name} {co.approved_by_profile.last_name}
                            {co.approved_at && ` on ${format(new Date(co.approved_at), "MMM d, yyyy")}`}
                          </p>
                        )}
                      </div>
                      {co.status === "pending" && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setChangeOrderToApprove(co);
                              setApprovalDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(co.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ProjectChangeOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        changeOrder={selectedChangeOrder}
        onSuccess={refetch}
      />

      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Change Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this change order? This will update the project's revised budget by{" "}
              {changeOrderToApprove && formatCurrency(changeOrderToApprove.budget_impact)}.
              Once approved, the change order cannot be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
