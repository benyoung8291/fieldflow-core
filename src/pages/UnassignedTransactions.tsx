import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";

export default function UnassignedTransactions() {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['unassigned-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .select(`
          *,
          company_credit_cards(card_name, card_provider, last_four_digits),
          assignedUser:profiles!credit_card_transactions_assigned_to_fkey(name)
        `)
        .or('is_assigned.eq.false,assigned_to.is.null')
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .order('first_name');
      
      if (error) throw error;
      return data?.map(u => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim()
      }));
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ transactionId, userId }: { transactionId: string; userId: string }) => {
      const { error } = await supabase
        .from('credit_card_transactions')
        .update({ 
          assigned_to: userId,
          is_assigned: true 
        })
        .eq('id', transactionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-transactions'] });
      toast.success('Transaction assigned');
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
      queryClient.invalidateQueries({ queryKey: ['unassigned-transactions'] });
      toast.success('Transactions synced');
    },
  });

  const handleProcessExpense = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsExpenseDialogOpen(true);
  };

  const handleExpenseCreated = async (expenseId: string) => {
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
      queryClient.invalidateQueries({ queryKey: ['unassigned-transactions'] });
      toast.success('Expense created');
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Unassigned Transactions</h1>
            <p className="text-muted-foreground">
              Assign transactions to users or process directly
            </p>
          </div>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Transactions
          </Button>
        </div>

        <div className="grid gap-4">
          {transactions?.map((txn) => (
            <Card key={txn.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="font-semibold">{txn.merchant_name || 'Unknown Merchant'}</h3>
                    <Badge variant="secondary">{txn.status}</Badge>
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
                  <p className="text-2xl font-bold">${txn.amount.toFixed(2)}</p>
                  <div className="flex items-center gap-2">
                    <Select
                      onValueChange={(userId) => assignMutation.mutate({ 
                        transactionId: txn.id, 
                        userId 
                      })}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => handleProcessExpense(txn)}>
                      Process
                    </Button>
                  </div>
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
