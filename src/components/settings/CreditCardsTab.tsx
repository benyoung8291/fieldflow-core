import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, CreditCard, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type CardFormData = {
  card_name: string;
  card_provider: string;
  last_four_digits: string;
  full_card_number?: string;
  assigned_to?: string;
};

export function CreditCardsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<any>(null);
  const queryClient = useQueryClient();

  const form = useForm<CardFormData>({
    defaultValues: {
      card_name: "",
      card_provider: "amex",
      last_four_digits: "",
      full_card_number: "",
      assigned_to: "",
    },
  });

  const { data: cards, isLoading } = useQuery({
    queryKey: ['company-credit-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_credit_cards')
        .select('*, assignedUser:profiles!company_credit_cards_assigned_to_fkey(id, first_name, last_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data?.map(card => {
        const typedCard = card as any;
        return {
          ...card,
          assignedUser: typedCard.assignedUser ? {
            id: typedCard.assignedUser.id,
            first_name: typedCard.assignedUser.first_name || '',
            last_name: typedCard.assignedUser.last_name || '',
            name: `${typedCard.assignedUser.first_name || ''} ${typedCard.assignedUser.last_name || ''}`.trim()
          } : null
        };
      });
    },
  });

  const { data: users } = useQuery({
    queryKey: ['users-for-cards'],
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

  const saveMutation = useMutation({
    mutationFn: async (values: CardFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      const cardData = {
        ...values,
        tenant_id: profile?.tenant_id,
        assigned_to: values.assigned_to || null,
      };

      if (editingCard) {
        const { error } = await supabase
          .from('company_credit_cards')
          .update(cardData)
          .eq('id', editingCard.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_credit_cards')
          .insert(cardData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-credit-cards'] });
      toast.success(editingCard ? 'Card updated' : 'Card added');
      setIsDialogOpen(false);
      setEditingCard(null);
      form.reset();
    },
    onError: (error) => {
      toast.error('Failed to save card');
      console.error(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_credit_cards')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-credit-cards'] });
      toast.success('Card deactivated');
    },
  });

  const handleEdit = (card: any) => {
    setEditingCard(card);
    form.reset({
      card_name: card.card_name,
      card_provider: card.card_provider,
      last_four_digits: card.last_four_digits,
      full_card_number: card.full_card_number || "",
      assigned_to: card.assigned_to || "",
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCard(null);
    form.reset();
    setIsDialogOpen(true);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Company Credit Cards</h3>
          <p className="text-sm text-muted-foreground">
            Manage credit cards and assign them to users for transaction reconciliation
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Card
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCard ? 'Edit Card' : 'Add Credit Card'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="card_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Card Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Company Amex" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="card_provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Card Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="amex">American Express</SelectItem>
                          <SelectItem value="visa">Visa</SelectItem>
                          <SelectItem value="mastercard">Mastercard</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_four_digits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last 4 Digits</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={4} placeholder="1234" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="full_card_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Card Number (for matching)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional - for transaction matching" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to User</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Unassigned</SelectItem>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {cards?.filter(c => c.is_active).map((card) => (
          <Card key={card.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CreditCard className="h-8 w-8 text-primary" />
                <div>
                  <h4 className="font-semibold">{card.card_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {card.card_provider.toUpperCase()} •••• {card.last_four_digits}
                  </p>
                  {card.assignedUser && (
                    <Badge variant="secondary" className="mt-1">
                      {card.assignedUser.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(card)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => deleteMutation.mutate(card.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
