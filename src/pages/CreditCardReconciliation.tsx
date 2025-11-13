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

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['my-credit-card-transactions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .select(`
          *,
          company_credit_cards(card_name, card_provider, last_four_digits),
          expenses(expense_number, status)
        `)
        .eq('assigned_to', user?.id)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
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

  const unreconciledCount = transactions?.filter(t => t.status === 'unreconciled').length || 0;

  if (isLoading) return <div>Loading...</div>;

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
              Review your credit card transactions...
            </div>
            <Card className="p-0 rounded-t-none">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="divide-y">
                  {transactions?.map((txn) => {
                    const isSelected = selectedTransaction?.id === txn.id;
                    const matches = findMatches(txn);
                    const isMatched = txn.status === 'reconciled';
                    
                    return (
                      <div
                        key={txn.id}
                        className={`p-3 cursor-pointer transition-colors ${
                          isMatched 
                            ? 'bg-emerald-50 hover:bg-emerald-100 border-l-4 border-emerald-500' 
                            : isSelected 
                            ? 'bg-blue-50 border-l-4 border-blue-500' 
                            : 'hover:bg-muted/30'
                        }`}
                        onClick={() => !isMatched && handleSelectTransaction(txn)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-muted-foreground mb-0.5">
                              {format(new Date(txn.transaction_date), 'MMM d, yyyy')}
                            </div>
                            <div className="font-semibold text-sm mb-0.5">
                              {txn.merchant_name || 'Unknown Merchant'}
                            </div>
                            {txn.external_reference && (
                              <div className="text-[11px] text-muted-foreground mb-1">
                                {txn.external_reference}
                              </div>
                            )}
                            <button className="text-[11px] text-blue-600 hover:underline">
                              More details
                            </button>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold mb-1">
                              ${txn.amount.toFixed(2)}
                            </div>
                            {isMatched ? (
                              <Button 
                                size="sm" 
                                className="h-7 px-4 bg-blue-600 hover:bg-blue-700 text-xs font-semibold"
                              >
                                OK
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="text-[11px] h-6 px-2">
                                Options <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Right Panel - Matching */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/40 rounded-t flex items-center justify-between">
              <span>...then match with your transactions</span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-semibold">Spent</span>
                <span className="font-semibold">Received</span>
              </div>
            </div>
            <Card className="p-0 rounded-t-none">
              <ScrollArea className="h-[calc(100vh-200px)]">
                {!selectedTransaction ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <p>Select a transaction from the left to match or create an expense</p>
                  </div>
                ) : (
                  <div className="p-3">
                    {/* Suggested Matches */}
                    {findMatches(selectedTransaction).map((match) => (
                      <div
                        key={match.id}
                        className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-muted-foreground mb-0.5">
                              {format(new Date(match.expense_date), 'dd MMM yyyy')}
                            </div>
                            <div className="font-semibold text-sm mb-0.5">
                              Expense: {match.expense_number}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {match.description}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-semibold text-sm">
                              ${parseFloat(match.amount.toString()).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-200">
                          <div className="flex gap-3">
                            <button className="text-[11px] text-blue-600 hover:underline font-medium">Match</button>
                            <button className="text-[11px] text-blue-600 hover:underline">Create</button>
                            <button className="text-[11px] text-blue-600 hover:underline">Transfer</button>
                            <button className="text-[11px] text-muted-foreground hover:underline">Discuss</button>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => matchMutation.mutate({
                              transactionId: selectedTransaction.id,
                              expenseId: match.id,
                            })}
                            disabled={matchMutation.isPending}
                            className="h-7 px-4 bg-blue-600 hover:bg-blue-700 text-xs font-semibold"
                          >
                            OK
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Create New Expense Form */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
                      <TabsList className="w-full justify-start h-8 p-0.5 bg-muted/40">
                        <TabsTrigger value="match" className="text-xs h-7">Match</TabsTrigger>
                        <TabsTrigger value="create" className="text-xs h-7">Create</TabsTrigger>
                        <TabsTrigger value="transfer" className="text-xs h-7">Transfer</TabsTrigger>
                        <TabsTrigger value="discuss" className="text-xs h-7">Discuss</TabsTrigger>
                      </TabsList>

                      <TabsContent value="match" className="space-y-2 mt-3">
                        {findMatches(selectedTransaction).length === 0 && (
                          <div className="p-3 bg-muted/30 rounded text-xs text-muted-foreground">
                            No matching expenses found. Create a new expense or check other tabs.
                          </div>
                        )}
                        <div className="text-right">
                          <Button 
                            size="sm" 
                            variant="link" 
                            className="text-blue-600 text-xs h-auto p-0 hover:underline"
                          >
                            Find & Match
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="create" className="space-y-3 mt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Who</Label>
                            <Select
                              value={formData.vendor_id}
                              onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                            >
                              <SelectTrigger className="h-7 text-xs mt-1">
                                <SelectValue placeholder="Name of the contact..." />
                              </SelectTrigger>
                              <SelectContent>
                                {vendors.map((vendor) => (
                                  <SelectItem key={vendor.id} value={vendor.id} className="text-xs">
                                    {vendor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-[11px] text-muted-foreground">What</Label>
                            <Select
                              value={formData.category_id}
                              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                            >
                              <SelectTrigger className="h-7 text-xs mt-1">
                                <SelectValue placeholder="Choose the account..." />
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
                          <Label className="text-[11px] text-muted-foreground">Why</Label>
                          <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="text-xs min-h-[50px] mt-1"
                            placeholder="Enter a description..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Region</Label>
                            <Select>
                              <SelectTrigger className="h-7 text-xs mt-1">
                                <SelectValue />
                              </SelectTrigger>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Tax Rate</Label>
                            <Select>
                              <SelectTrigger className="h-7 text-xs mt-1">
                                <SelectValue />
                              </SelectTrigger>
                            </Select>
                          </div>
                        </div>

                        <div className="text-right">
                          <Button 
                            variant="link" 
                            className="text-blue-600 text-xs h-auto p-0 hover:underline mr-3"
                          >
                            Add details
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="transfer" className="mt-3">
                        <div className="p-3 bg-muted/30 rounded text-xs text-muted-foreground">
                          Transfer functionality not available for expenses
                        </div>
                      </TabsContent>

                      <TabsContent value="discuss" className="mt-3">
                        <div className="p-3 bg-muted/30 rounded text-xs text-muted-foreground">
                          Discussion feature coming soon
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <div className="flex gap-3">
                        <button className="text-[11px] text-blue-600 hover:underline font-medium">Match</button>
                        <button className="text-[11px] text-blue-600 hover:underline font-medium">Create</button>
                        <button className="text-[11px] text-blue-600 hover:underline">Transfer</button>
                        <button className="text-[11px] text-muted-foreground hover:underline">Discuss</button>
                      </div>
                      {activeTab === 'create' && (
                        <Button
                          size="sm"
                          onClick={handleCreateExpense}
                          disabled={createExpenseMutation.isPending || !formData.description}
                          className="h-7 px-4 bg-blue-600 hover:bg-blue-700 text-xs font-semibold"
                        >
                          OK
                        </Button>
                      )}
                      {findMatches(selectedTransaction).length === 0 && activeTab === 'match' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 px-4 text-xs"
                          onClick={() => setActiveTab('create')}
                        >
                          Create
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
