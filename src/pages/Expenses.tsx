import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";
import { usePagination } from "@/hooks/usePagination";
import { PermissionButton } from "@/components/permissions";

export default function Expenses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const pagination = usePagination({ initialPageSize: 50 });

  const { data: expensesResponse, isLoading, refetch } = useQuery({
    queryKey: ["expenses", searchTerm, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { from, to } = pagination.getRange();
      let query = supabase
        .from("expenses")
        .select(`
          *,
          supplier:suppliers(name),
          category:expense_categories(name),
          service_order:service_orders(work_order_number),
          project:projects(name),
          submitted_by_user:profiles!expenses_submitted_by_fkey(first_name, last_name)
        `, { count: 'exact' })
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`description.ilike.%${searchTerm}%,expense_number.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });
  
  const expenses = expensesResponse?.data || [];
  const totalCount = expensesResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      draft: "secondary",
      submitted: "default",
      approved: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Expenses</h1>
            <p className="text-muted-foreground">
              Manage and track business expenses
            </p>
          </div>
          <PermissionButton
            module="expenses"
            permission="create"
            onClick={() => setIsDialogOpen(true)}
            hideIfNoPermission={true}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Expense
          </PermissionButton>
        </div>

        <Card className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>Submitted By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense: any) => (
                <TableRow
                  key={expense.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/expenses/${expense.id}`)}
                >
                  <TableCell className="font-medium">{expense.expense_number}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>${parseFloat(expense.amount).toFixed(2)}</TableCell>
                  <TableCell>{format(new Date(expense.expense_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{expense.vendor?.name || "-"}</TableCell>
                  <TableCell>{expense.category?.name || "-"}</TableCell>
                  <TableCell>{getStatusBadge(expense.status)}</TableCell>
                  <TableCell>
                    {expense.sync_status ? (
                      <Badge 
                        variant={
                          expense.sync_status === "synced" ? "default" : 
                          expense.sync_status === "error" ? "destructive" : 
                          "secondary"
                        }
                      >
                        {expense.sync_status}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {expense.submitted_by_user?.first_name} {expense.submitted_by_user?.last_name}
                  </TableCell>
                </TableRow>
              ))}
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No expenses found. Create your first expense to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 border-t pt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} expenses
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => pagination.prevPage()} disabled={pagination.currentPage === 0}>
                Previous
              </Button>
              <div className="text-sm">Page {pagination.currentPage + 1} of {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => pagination.nextPage()} disabled={pagination.currentPage >= totalPages - 1}>
                Next
              </Button>
            </div>
          </div>
        )}

        <ExpenseDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={() => refetch()}
        />
      </div>
    </DashboardLayout>
  );
}
