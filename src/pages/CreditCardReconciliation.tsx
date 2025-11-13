import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";

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
      toast.success('Expense created and linked');
    }
  };

  const unreconciledCount = transactions?.filter(t => t.status === 'unreconciled').length || 0;

  if (isLoading) return <div>Loading...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Credit Card Reconciliation</h1>
            <p className="text-muted-foreground">
              Create expenses for your credit card transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-base py-2 px-4">
              {unreconciledCount} Unreconciled
            </Badge>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Transactions
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {transactions?.map((txn) => (
            <Card key={txn.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="font-semibold">{txn.merchant_name || 'Unknown Merchant'}</h3>
                    <Badge variant={txn.status === 'reconciled' ? 'default' : 'secondary'}>
                      {txn.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{txn.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{format(new Date(txn.transaction_date), 'MMM dd, yyyy')}</span>
                    {txn.company_credit_cards && (
                      <span>
                        {txn.company_credit_cards.card_provider.toUpperCase()} 
                        •••• {txn.company_credit_cards.last_four_digits}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold">${txn.amount.toFixed(2)}</p>
                    {txn.expenses && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => navigate(`/expenses/${txn.expense_id}`)}
                      >
                        View Expense
                      </Button>
                    )}
                  </div>
                  {txn.status === 'unreconciled' && (
                    <Button onClick={() => handleCreateExpense(txn)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Expense
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
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
