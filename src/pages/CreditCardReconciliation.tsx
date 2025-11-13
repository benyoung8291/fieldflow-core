import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Check, ExternalLink } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CreditCardReconciliation() {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
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

  const handleCreateExpense = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsExpenseDialogOpen(true);
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
      toast.success('Transaction matched to expense');
    },
    onError: () => {
      toast.error('Failed to match transaction');
    },
  });

  const handleExpenseCreated = async (expenseId: string) => {
    // Link transaction to expense
    const { error } = await supabase
      .from('credit_card_transactions')
      .update({ 
        expense_id: expenseId,
        status: 'reconciled'
      })
      .eq('id', selectedTransaction.id);

    if (error) {
      toast.error('Failed to link expense');
    } else {
      queryClient.invalidateQueries({ queryKey: ['my-credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['potential-expense-matches'] });
      toast.success('Expense created and linked');
    }
  };

  const unreconciledCount = transactions?.filter(t => t.status === 'unreconciled').length || 0;

  if (isLoading) return <div>Loading...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Credit Card Reconciliation</h1>
            <p className="text-muted-foreground">
              Match transactions to expenses or create new ones
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-base py-2 px-4">
              {unreconciledCount} Unreconciled
            </Badge>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Button>
          </div>
        </div>

        <Card>
          <ScrollArea className="h-[calc(100vh-250px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Suggested Match</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.map((txn) => {
                  const matches = findMatches(txn);
                  const suggestedMatch = matches[0];
                  
                  return (
                    <TableRow key={txn.id}>
                      <TableCell className="font-medium">
                        {format(new Date(txn.transaction_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{txn.merchant_name || 'Unknown Merchant'}</p>
                          <p className="text-sm text-muted-foreground">{txn.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {txn.company_credit_cards && (
                            <>
                              <p className="font-medium">{txn.company_credit_cards.card_name}</p>
                              <p className="text-muted-foreground">
                                {txn.company_credit_cards.card_provider.toUpperCase()} •••• {txn.company_credit_cards.last_four_digits}
                              </p>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${txn.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={txn.status === 'reconciled' ? 'default' : 'secondary'}>
                          {txn.status === 'reconciled' ? 'Matched' : 'Unmatched'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {txn.status === 'unreconciled' && suggestedMatch && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Suggested Match
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <p className="font-medium">{suggestedMatch.expense_number}</p>
                              <p className="text-muted-foreground">{suggestedMatch.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(suggestedMatch.expense_date), 'dd MMM yyyy')} • ${parseFloat(suggestedMatch.amount.toString()).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        )}
                        {txn.status === 'reconciled' && txn.expenses && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => navigate(`/expenses/${txn.expense_id}`)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {txn.expenses.expense_number}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.status === 'unreconciled' && (
                          <div className="flex items-center justify-end gap-2">
                            {suggestedMatch ? (
                              <>
                                <Button 
                                  size="sm"
                                  variant="default"
                                  onClick={() => matchMutation.mutate({ 
                                    transactionId: txn.id, 
                                    expenseId: suggestedMatch.id 
                                  })}
                                  disabled={matchMutation.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Confirm Match
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateExpense(txn)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Create New
                                </Button>
                              </>
                            ) : (
                              <Button 
                                size="sm"
                                onClick={() => handleCreateExpense(txn)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Create Expense
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </div>

      {selectedTransaction && (
        <ExpenseDialog
          open={isExpenseDialogOpen}
          onOpenChange={setIsExpenseDialogOpen}
          onSuccess={handleExpenseCreated}
          defaultValues={{
            description: selectedTransaction.description,
            amount: selectedTransaction.amount,
            expense_date: selectedTransaction.transaction_date,
          }}
        />
      )}
    </DashboardLayout>
  );
}
