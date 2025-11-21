import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, ChevronDown, ExternalLink, CheckCircle2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePagination } from "@/hooks/usePagination";

export default function CreditCardReconciliation() {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [creatingExpenseForTxn, setCreatingExpenseForTxn] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    expense_date: "",
    supplier_id: "",
    category_id: "",
    notes: "",
    reference_number: "",
    account_code: "",
    sub_account: "",
    service_order_id: "",
    project_id: "",
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pagination = usePagination({ initialPageSize: 50 });

  const { data: transactionsResponse, isLoading, error: transactionsError } = useQuery({
    queryKey: ['my-credit-card-transactions', pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const { from, to } = pagination.getRange();
      const { data, error, count } = await supabase
        .from('credit_card_transactions')
        .select(`
          *,
          company_credit_cards(card_name, card_provider, last_four_digits),
          expenses(expense_number, status)
        `, { count: 'exact' })
        .eq('assigned_to', user.id)
        .order('transaction_date', { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error('Transaction fetch error:', error);
        throw error;
      }
      return { data: data || [], count: count || 0 };
    },
  });
  
  const transactions = transactionsResponse?.data || [];
  const totalCount = transactionsResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  // Fetch potential matching expenses
  const { data: potentialMatches } = useQuery({
    queryKey: ['potential-expense-matches'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('submitted_by', user?.id)
        .eq('payment_method', 'credit_card')
        .eq('status', 'submitted')
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Function to find matching expenses for a transaction
  const findMatches = (transaction: any) => {
    if (!potentialMatches) return [];
    
    return potentialMatches.filter(expense => {
      const amountMatch = Math.abs(parseFloat(expense.amount.toString()) - parseFloat(transaction.amount.toString())) < 0.01;
      const dateDiff = Math.abs(differenceInDays(new Date(expense.expense_date), new Date(transaction.transaction_date)));
      const dateMatch = dateDiff <= 7; // Within 7 days
      
      return amountMatch && dateMatch;
    });
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: integration } = await supabase
        .from('accounting_integrations')
        .select('provider')
        .single();

      const functionName = integration?.provider === 'xero' 
        ? 'sync-credit-card-transactions-xero'
        : 'sync-credit-card-transactions-acumatica';

      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-credit-card-transactions'] });
      toast.success('Transactions synced successfully');
    },
    onError: () => {
      toast.error('Failed to sync transactions');
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["service-orders"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("service_orders")
        .select("id, work_order_number, purchase_order_number")
        .eq("tenant_id", profile.tenant_id)
        .order("work_order_number");

      if (error) throw error;
      return data || [];
    },
  });

  const handleSelectTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setCreatingExpenseForTxn(transaction.id);
    setFormData({
      description: transaction.merchant_name || "",
      amount: transaction.amount?.toString() || "",
      expense_date: transaction.transaction_date || "",
      supplier_id: "",
      category_id: "",
      notes: "",
      reference_number: transaction.external_reference || "",
      account_code: "",
      sub_account: "",
      service_order_id: "",
      project_id: "",
    });
  };

  const matchMutation = useMutation({
    mutationFn: async ({ transactionId, expenseId }: { transactionId: string; expenseId: string }) => {
      const { error } = await supabase
        .from('credit_card_transactions')
        .update({ 
          expense_id: expenseId,
          status: 'reconciled'
        })
        .eq('id', transactionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['potential-expense-matches'] });
      setSelectedTransaction(null);
      toast.success('Transaction matched');
    },
    onError: () => {
      toast.error('Failed to match transaction');
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: typeof formData & { transactionId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Get next expense number
      const { data: numberSettings } = await supabase
        .from("sequential_number_settings")
        .select("next_number, prefix, number_length")
        .eq("tenant_id", profile.tenant_id)
        .eq("entity_type", "expense")
        .maybeSingle();

      let expenseNumber = "EXP-0001";
      if (numberSettings) {
        expenseNumber = `${numberSettings.prefix}${String(numberSettings.next_number).padStart(numberSettings.number_length, "0")}`;
        await supabase
          .from("sequential_number_settings")
          .update({ next_number: numberSettings.next_number + 1 })
          .eq("tenant_id", profile.tenant_id)
          .eq("entity_type", "expense");
      } else {
        await supabase.from("sequential_number_settings").insert({
          tenant_id: profile.tenant_id,
          entity_type: "expense",
          prefix: "EXP-",
          next_number: 2,
          number_length: 4,
        });
      }

      const { data: newExpense, error } = await supabase
        .from("expenses")
        .insert({
          tenant_id: profile.tenant_id,
          expense_number: expenseNumber,
          description: data.description,
          amount: parseFloat(data.amount),
          expense_date: data.expense_date,
          submitted_by: user.id,
          supplier_id: data.supplier_id || null,
          category_id: data.category_id || null,
          payment_method: "credit_card",
          status: "submitted",
          notes: data.notes || null,
          reference_number: data.reference_number || null,
          account_code: data.account_code || null,
          sub_account: data.sub_account || null,
          service_order_id: data.service_order_id || null,
          project_id: data.project_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Link to transaction
      const { error: linkError } = await supabase
        .from('credit_card_transactions')
        .update({ 
          expense_id: newExpense.id,
          status: 'reconciled'
        })
        .eq('id', data.transactionId);

      if (linkError) throw linkError;

      return newExpense.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['potential-expense-matches'] });
      handleCancelCreate();
      toast.success('Expense created and matched');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create expense');
    },
  });

  const handleCreateExpense = (transactionId: string) => {
    createExpenseMutation.mutate({
      ...formData,
      transactionId: transactionId,
    });
  };

  const handleCancelCreate = () => {
    setCreatingExpenseForTxn(null);
    setSelectedTransaction(null);
    setFormData({
      description: "",
      amount: "",
      expense_date: "",
      supplier_id: "",
      category_id: "",
      notes: "",
      reference_number: "",
      account_code: "",
      sub_account: "",
      service_order_id: "",
      project_id: "",
    });
  };

  // Filter out reconciled transactions and expenses
  const unreconciledTransactions = transactions?.filter(t => t.status === 'unreconciled') || [];
  const unreconciledExpenses = potentialMatches?.filter(e => 
    !transactions?.some(t => t.expense_id === e.id)
  ) || [];

  const unreconciledCount = unreconciledTransactions.length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (transactionsError) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Reconcile</h1>
          <Card className="p-6">
            <div className="text-center space-y-2">
              <p className="text-destructive">Error loading transactions</p>
              <p className="text-sm text-muted-foreground">{transactionsError.message}</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['my-credit-card-transactions'] })}>
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Reconcile (0)</h1>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} size="sm" variant="outline">
              <RefreshCw className="h-3 w-3 mr-2" />
              Sync
            </Button>
          </div>
          <Card className="p-6">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">No transactions found</p>
              <p className="text-sm text-muted-foreground">Sync your credit card to see transactions</p>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Reconcile ({unreconciledCount})</h1>
          </div>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-2" />
            Sync
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3 p-3">
            {unreconciledTransactions.length === 0 ? (
              <Card className="p-8">
                <div className="text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
                  <p className="text-muted-foreground">All transactions matched!</p>
                </div>
              </Card>
            ) : (
              unreconciledTransactions.map((txn) => {
                const matches = findMatches(txn);
                const hasMatch = matches.length > 0;
                
                return (
                  <div key={txn.id} className="grid grid-cols-2 gap-3">
                    {/* Left: Transaction Card */}
                    <Card className="p-4 hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-[11px] text-muted-foreground">
                                {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
                              </div>
                            </div>
                            <div className="font-semibold text-base mb-1">
                              {txn.merchant_name || 'Unknown Merchant'}
                            </div>
                            {txn.external_reference && (
                              <div className="text-xs text-muted-foreground mb-2">
                                {txn.external_reference}
                              </div>
                            )}
                            <button className="text-[11px] text-blue-600 hover:underline">
                              More details
                            </button>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              ${txn.amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Right: Matching Card or Create Options */}
                    {hasMatch ? (
                      <Card className="p-4 bg-emerald-50 border-emerald-300 hover:shadow-md transition-shadow">
                        {matches.map((match, index) => (
                          <div key={match.id}>
                            {index > 0 && <div className="my-3 border-t border-emerald-200" />}
                            <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
                                    <Check className="h-3.5 w-3.5 text-white" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] text-muted-foreground mb-1">
                                    {format(new Date(match.expense_date), 'dd MMM yyyy')}
                                  </div>
                                  <div className="font-semibold text-base mb-1">
                                    Expense: {match.expense_number}
                                  </div>
                                  <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {match.description || 'No description'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">
                                    ${match.amount.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                                <div className="flex gap-3">
                                  <button className="text-[11px] text-blue-600 hover:underline font-medium">
                                    Match
                                  </button>
                                  <button className="text-[11px] text-blue-600 hover:underline">
                                    Create
                                  </button>
                                  <button className="text-[11px] text-blue-600 hover:underline">
                                    Transfer
                                  </button>
                                  <button className="text-[11px] text-muted-foreground hover:underline">
                                    Discuss
                                  </button>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => matchMutation.mutate({ transactionId: txn.id, expenseId: match.id })}
                                  disabled={matchMutation.isPending}
                                  className="h-8 px-6 bg-blue-600 hover:bg-blue-700 font-semibold"
                                >
                                  OK
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </Card>
                    ) : creatingExpenseForTxn === txn.id ? (
                      <Card className="p-4 hover:shadow-md transition-shadow">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Supplier *</Label>
                              <Select
                                value={formData.supplier_id}
                                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1">
                                  <SelectValue placeholder="Select supplier..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id} className="text-xs">
                                      {supplier.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label className="text-[11px] text-muted-foreground">Category *</Label>
                              <Select
                                value={formData.category_id}
                                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1">
                                  <SelectValue placeholder="Select category..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id} className="text-xs">
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label className="text-[11px] text-muted-foreground">Description *</Label>
                            <Textarea
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              className="text-xs min-h-[50px] mt-1"
                              placeholder="Enter description..."
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Date *</Label>
                              <Input
                                type="date"
                                value={formData.expense_date}
                                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                                className="h-8 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Amount *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="h-8 text-xs mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Reference #</Label>
                              <Input
                                type="text"
                                value={formData.reference_number}
                                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                                className="h-8 text-xs mt-1"
                                placeholder="Ref number..."
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-[11px] text-muted-foreground">Project (Optional)</Label>
                            <Select
                              value={formData.project_id || "none"}
                              onValueChange={(value) => setFormData({ ...formData, project_id: value === "none" ? "" : value, service_order_id: "" })}
                            >
                              <SelectTrigger className="h-8 text-xs mt-1">
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-[11px] text-muted-foreground">Service Order (Optional)</Label>
                            <Select
                              value={formData.service_order_id || "none"}
                              onValueChange={(value) => setFormData({ ...formData, service_order_id: value === "none" ? "" : value, project_id: "" })}
                            >
                              <SelectTrigger className="h-8 text-xs mt-1">
                                <SelectValue placeholder="Select service order" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {serviceOrders.map((so) => (
                                  <SelectItem key={so.id} value={so.id}>
                                    {so.work_order_number} {so.purchase_order_number && `- PO: ${so.purchase_order_number}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-[11px] text-muted-foreground">Notes</Label>
                            <Textarea
                              value={formData.notes}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              className="text-xs min-h-[40px] mt-1"
                              placeholder="Additional notes..."
                            />
                          </div>

                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-3">
                                <button 
                                  className="text-[11px] text-blue-600 hover:underline"
                                  onClick={handleCancelCreate}
                                >
                                  Match
                                </button>
                                <button className="text-[11px] text-blue-600 hover:underline font-medium">
                                  Create
                                </button>
                                <button className="text-[11px] text-blue-600 hover:underline">
                                  Transfer
                                </button>
                                <button className="text-[11px] text-muted-foreground hover:underline">
                                  Discuss
                                </button>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleCreateExpense(txn.id)}
                                disabled={createExpenseMutation.isPending || !formData.description || !formData.supplier_id || !formData.category_id}
                                className="h-8 px-6 bg-blue-600 hover:bg-blue-700 font-semibold"
                              >
                                OK
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Card className="p-4 hover:shadow-md transition-shadow">
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground italic">
                            This is payment on a really old invoice so wasn't sure where to code it
                          </div>
                          <div className="text-[10px] text-muted-foreground italic">
                            Ctrl + S at any time to save
                          </div>
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-3">
                                <button className="text-[11px] text-blue-600 hover:underline">
                                  Match
                                </button>
                                <button 
                                  className="text-[11px] text-blue-600 hover:underline font-medium"
                                  onClick={() => handleSelectTransaction(txn)}
                                >
                                  Create
                                </button>
                                <button className="text-[11px] text-blue-600 hover:underline">
                                  Transfer
                                </button>
                                <button className="text-[11px] text-muted-foreground hover:underline">
                                  Discuss
                                </button>
                              </div>
                              <Button
                                size="sm"
                                variant="link"
                                className="text-blue-600 text-[11px] h-auto p-0 hover:underline"
                              >
                                Find & Match
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                );
              })
            )}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 p-4 border-t flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} transactions
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
          </div>
        </ScrollArea>
      </div>
    </DashboardLayout>
  );
}
