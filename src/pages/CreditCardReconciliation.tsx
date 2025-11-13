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

export default function CreditCardReconciliation() {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("match");
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    expense_date: "",
    vendor_id: "",
    category_id: "",
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: transactions, isLoading, error: transactionsError } = useQuery({
    queryKey: ['my-credit-card-transactions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .select(`
          *,
          company_credit_cards(card_name, card_provider, last_four_digits),
          expenses(expense_number, status)
        `)
        .eq('assigned_to', user.id)
        .order('transaction_date', { ascending: false });
      
      if (error) {
        console.error('Transaction fetch error:', error);
        throw error;
      }
      return data;
    },
  });

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

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("vendors")
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

  const handleSelectTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setFormData({
      description: transaction.description || "",
      amount: transaction.amount?.toString() || "",
      expense_date: transaction.transaction_date || "",
      vendor_id: "",
      category_id: "",
    });
    setActiveTab("match");
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
          vendor_id: data.vendor_id || null,
          category_id: data.category_id || null,
          payment_method: "credit_card",
          status: "submitted",
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
      setSelectedTransaction(null);
      setFormData({
        description: "",
        amount: "",
        expense_date: "",
        vendor_id: "",
        category_id: "",
      });
      toast.success('Expense created and matched');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create expense');
    },
  });

  const handleCreateExpense = () => {
    if (!selectedTransaction) return;
    
    createExpenseMutation.mutate({
      ...formData,
      transactionId: selectedTransaction.id,
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

        <div className="grid grid-cols-2 gap-3">
          {/* Left Panel - Transactions */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/40 rounded-t">
              Credit Card Transactions
            </div>
            <Card className="p-0 rounded-t-none">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="p-2 space-y-2">
                  {unreconciledTransactions.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                      <p>All transactions matched!</p>
                    </div>
                  ) : (
                    unreconciledTransactions.map((txn) => {
                      const matches = findMatches(txn);
                      
                      return (
                        <Card key={txn.id} className="p-3 hover:shadow-md transition-shadow">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] text-muted-foreground mb-0.5">
                                  {format(new Date(txn.transaction_date), 'MMM d, yyyy')}
                                </div>
                                <div className="font-semibold text-sm mb-0.5">
                                  {txn.merchant_name || 'Unknown Merchant'}
                                </div>
                                {txn.external_reference && (
                                  <div className="text-[11px] text-muted-foreground">
                                    {txn.external_reference}
                                  </div>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-semibold">
                                  ${txn.amount.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            {matches.length > 0 && (
                              <div className="pt-2 border-t space-y-1">
                                {matches.map((match) => (
                                  <button
                                    key={match.id}
                                    onClick={() => matchMutation.mutate({ transactionId: txn.id, expenseId: match.id })}
                                    className="w-full p-2 bg-emerald-50 border border-emerald-300 rounded text-left hover:bg-emerald-100 transition-colors"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-1">
                                        <Check className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                                        <div className="text-[11px] font-medium">
                                          {match.expense_number}
                                        </div>
                                      </div>
                                      <Button size="sm" className="h-6 px-3 bg-emerald-600 hover:bg-emerald-700 text-xs">
                                        Match
                                      </Button>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Right Panel - Expenses */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/40 rounded-t">
              Submitted Expenses
            </div>
            <Card className="p-0 rounded-t-none">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="p-2 space-y-2">
                  {unreconciledExpenses.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                      <p>All expenses matched!</p>
                    </div>
                  ) : (
                    unreconciledExpenses.map((expense) => (
                      <Card key={expense.id} className="p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-muted-foreground mb-0.5">
                              {format(new Date(expense.expense_date), 'MMM d, yyyy')}
                            </div>
                            <div className="font-semibold text-sm mb-0.5">
                              Expense: {expense.expense_number}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {expense.description}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold">
                              ${expense.amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
