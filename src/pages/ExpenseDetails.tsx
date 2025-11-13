import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, CheckCircle, XCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ExpenseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  const { data: expense, isLoading } = useQuery({
    queryKey: ["expense", id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (error) throw error;

      // Fetch related data
      const vendor = data.vendor_id ? await supabase
        .from("vendors")
        .select("name")
        .eq("id", data.vendor_id)
        .single() : null;

      const category = data.category_id ? await supabase
        .from("expense_categories")
        .select("name")
        .eq("id", data.category_id)
        .single() : null;

      const service_order = data.service_order_id ? await supabase
        .from("service_orders")
        .select("work_order_number")
        .eq("id", data.service_order_id)
        .single() : null;

      const project = data.project_id ? await supabase
        .from("projects")
        .select("name")
        .eq("id", data.project_id)
        .single() : null;

      const submitted_by_user = data.submitted_by ? await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", data.submitted_by)
        .single() : null;

      const approved_by_user = data.approved_by ? await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", data.approved_by)
        .single() : null;

      return {
        ...data,
        vendor: vendor?.data,
        category: category?.data,
        service_order: service_order?.data,
        project: project?.data,
        submitted_by_user: submitted_by_user?.data,
        approved_by_user: approved_by_user?.data,
      };
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["expense-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_attachments")
        .select("*")
        .eq("expense_id", id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("expenses")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
      toast.success("Expense approved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to approve expense");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from("expenses")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
      toast.success("Expense rejected");
      setShowRejectionInput(false);
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to reject expense");
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!expense) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">Expense not found</div>
      </DashboardLayout>
    );
  }

  const canApprove = expense.status === "submitted";

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/expenses")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{expense.expense_number}</h1>
              <p className="text-muted-foreground">{expense.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {expense.status === "draft" && (
              <Button onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {canApprove && (
              <>
                <Button variant="outline" onClick={() => setShowRejectionInput(true)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button onClick={() => approveMutation.mutate()}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>

        {showRejectionInput && (
          <Card className="p-4">
            <Label>Rejection Reason</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="mt-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowRejectionInput(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => rejectMutation.mutate(rejectionReason)}
                disabled={!rejectionReason}
              >
                Confirm Rejection
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Expense Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold">${Number(expense.amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(String(expense.expense_date)), "MMM dd, yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{expense.status}</Badge>
                </div>
                {expense.vendor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor</p>
                    <p className="font-medium">{expense.vendor.name}</p>
                  </div>
                )}
                {expense.category && (
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{expense.category.name}</p>
                  </div>
                )}
                {expense.payment_method && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium capitalize">{expense.payment_method.replace("_", " ")}</p>
                  </div>
                )}
                {expense.reference_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reference #</p>
                    <p className="font-medium">{expense.reference_number}</p>
                  </div>
                )}
                {expense.account_code && (
                  <div>
                    <p className="text-sm text-muted-foreground">Account Code</p>
                    <p className="font-medium">{expense.account_code}</p>
                  </div>
                )}
                {expense.sub_account && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sub-Account</p>
                    <p className="font-medium">{expense.sub_account}</p>
                  </div>
                )}
              </div>
            </div>

            {(expense.service_order || expense.project) && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Linked Documents</h3>
                  {expense.service_order && (
                    <p className="text-sm">
                      Service Order: <span className="font-medium">{expense.service_order.work_order_number}</span>
                    </p>
                  )}
                  {expense.project && (
                    <p className="text-sm">
                      Project: <span className="font-medium">{expense.project.name}</span>
                    </p>
                  )}
                </div>
              </>
            )}

            {expense.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{expense.notes}</p>
                </div>
              </>
            )}

            {expense.rejection_reason && (
              <>
                <Separator />
                <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                  <h3 className="font-semibold text-destructive mb-2">Rejection Reason</h3>
                  <p className="text-sm">{expense.rejection_reason}</p>
                </div>
              </>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Attachments</h3>
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment: any) => (
                    <div key={attachment.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm truncate flex-1">{attachment.file_name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(attachment.file_url, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attachments</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Timeline</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Submitted</p>
                  <p className="text-xs text-muted-foreground">
                    {expense.submitted_by_user?.first_name} {expense.submitted_by_user?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(expense.created_at), "MMM dd, yyyy HH:mm")}
                  </p>
                </div>
                {expense.approved_at && (
                  <div>
                    <p className="text-sm font-medium">Approved</p>
                    <p className="text-xs text-muted-foreground">
                      {expense.approved_by_user?.first_name} {expense.approved_by_user?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.approved_at), "MMM dd, yyyy HH:mm")}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <ExpenseDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          expense={expense}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["expense", id] })}
        />
      </div>
    </DashboardLayout>
  );
}
