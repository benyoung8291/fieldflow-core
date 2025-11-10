import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectChangeOrdersTabProps {
  projectId: string;
}

export default function ProjectChangeOrdersTab({ projectId }: ProjectChangeOrdersTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    change_order_number: "",
    title: "",
    description: "",
    reason: "",
    budget_impact: "",
    schedule_impact_days: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: changeOrders, isLoading } = useQuery({
    queryKey: ["project-change-orders", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_change_orders")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch user details separately
      const ordersWithUsers = await Promise.all((data || []).map(async (co: any) => {
        let requester = null;
        let approver = null;

        if (co.requested_by) {
          const { data: req } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", co.requested_by)
            .single();
          requester = req;
        }

        if (co.approved_by) {
          const { data: app } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", co.approved_by)
            .single();
          approver = app;
        }

        return { ...co, requester, approver };
      }));

      return ordersWithUsers;
    },
  });

  const createChangeOrderMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase.from("project_change_orders").insert({
        tenant_id: profile.tenant_id,
        project_id: projectId,
        change_order_number: formData.change_order_number,
        title: formData.title,
        description: formData.description,
        reason: formData.reason,
        budget_impact: parseFloat(formData.budget_impact) || 0,
        schedule_impact_days: formData.schedule_impact_days ? parseInt(formData.schedule_impact_days) : 0,
        notes: formData.notes,
        requested_by: user.id,
        status: "draft",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-change-orders", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Change order created");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create change order");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updateData: any = { status };
      
      if (status === "approved") {
        updateData.approved_by = user.id;
        updateData.approved_at = new Date().toISOString();
      } else if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("project_change_orders")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-change-orders", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Change order status updated");
    },
    onError: () => {
      toast.error("Failed to update change order");
    },
  });

  const resetForm = () => {
    setFormData({
      change_order_number: "",
      title: "",
      description: "",
      reason: "",
      budget_impact: "",
      schedule_impact_days: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.change_order_number || !formData.title) {
      toast.error("Please fill in required fields");
      return;
    }
    createChangeOrderMutation.mutate();
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    pending_approval: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Change Orders</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Change Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Change Order</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Change Order Number *</Label>
                    <Input
                      value={formData.change_order_number}
                      onChange={(e) => setFormData({ ...formData, change_order_number: e.target.value })}
                      placeholder="CO-001"
                    />
                  </div>
                  <div>
                    <Label>Budget Impact ($) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.budget_impact}
                      onChange={(e) => setFormData({ ...formData, budget_impact: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Change order title"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed description of the change"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Reason</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Reason for this change order"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Schedule Impact (days)</Label>
                  <Input
                    type="number"
                    value={formData.schedule_impact_days}
                    onChange={(e) => setFormData({ ...formData, schedule_impact_days: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createChangeOrderMutation.isPending}>
                    {createChangeOrderMutation.isPending ? "Creating..." : "Create Change Order"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading change orders...</div>
        ) : changeOrders && changeOrders.length > 0 ? (
          <div className="space-y-4">
            {changeOrders.map((co) => (
              <Card key={co.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{co.title}</h4>
                        <Badge variant="outline" className={statusColors[co.status]}>
                          {co.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">CO #{co.change_order_number}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${co.budget_impact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {co.budget_impact >= 0 ? '+' : ''}${co.budget_impact.toLocaleString()}
                      </p>
                      {co.schedule_impact_days !== 0 && (
                        <p className="text-sm text-muted-foreground">
                          {co.schedule_impact_days > 0 ? '+' : ''}{co.schedule_impact_days} days
                        </p>
                      )}
                    </div>
                  </div>

                  {co.description && (
                    <p className="text-sm mb-2">{co.description}</p>
                  )}
                  
                  {co.reason && (
                    <p className="text-sm text-muted-foreground mb-3">
                      <strong>Reason:</strong> {co.reason}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                      Requested by {co.requester?.first_name} {co.requester?.last_name} on{' '}
                      {format(new Date(co.requested_at), "MMM d, yyyy")}
                    </div>
                    
                    {co.status === "draft" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: co.id, status: "pending_approval" })}
                        >
                          Submit for Approval
                        </Button>
                      </div>
                    )}
                    
                    {co.status === "pending_approval" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600"
                          onClick={() => updateStatusMutation.mutate({ id: co.id, status: "approved" })}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => updateStatusMutation.mutate({ id: co.id, status: "rejected" })}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {co.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: co.id, status: "completed" })}
                      >
                        Mark Complete
                      </Button>
                    )}
                  </div>

                  {co.approved_by && co.approved_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Approved by {co.approver?.first_name} {co.approver?.last_name} on{' '}
                      {format(new Date(co.approved_at), "MMM d, yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No change orders yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}