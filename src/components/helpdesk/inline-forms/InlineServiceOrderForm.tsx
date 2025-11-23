import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface InlineServiceOrderFormProps {
  parsedData?: any;
  ticket: any;
  onSuccess: (id: string) => void;
  onCancel: () => void;
}

export function InlineServiceOrderForm({ parsedData, ticket, onSuccess, onCancel }: InlineServiceOrderFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: parsedData?.title || ticket?.subject || "",
    description: parsedData?.description || ticket?.description || "",
    preferred_start_date: parsedData?.preferred_start_date || "",
    preferred_end_date: parsedData?.preferred_end_date || "",
    priority: parsedData?.priority || "medium",
    tax_rate: 10,
  });
  const [lineItems, setLineItems] = useState<LineItem[]>(
    parsedData?.line_items?.length > 0 
      ? parsedData.line_items 
      : [{ description: "", quantity: 1, unit_price: 0, line_total: 0 }]
  );

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const tax_amount = subtotal * (formData.tax_rate / 100);
    const total_amount = subtotal + tax_amount;
    return { subtotal, tax_amount, total_amount };
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    }
    
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { subtotal, tax_amount, total_amount } = calculateTotals();

      // Create service order
      const { data: serviceOrder, error: orderError } = await supabase
        .from('service_orders' as any)
        .insert({
          title: formData.title,
          description: formData.description,
          preferred_start_date: formData.preferred_start_date || null,
          preferred_end_date: formData.preferred_end_date || null,
          priority: formData.priority,
          status: 'draft',
          subtotal,
          tax_amount,
          total_amount,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (orderError || !serviceOrder) throw orderError || new Error("Failed to create service order");

      // Insert line items
      if (lineItems.length > 0 && lineItems[0].description) {
        const lineItemsToInsert = lineItems
          .filter(item => item.description.trim())
          .map((item, index) => ({
            service_order_id: (serviceOrder as any).id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            item_order: index,
            tenant_id: profile.tenant_id,
          }));

        if (lineItemsToInsert.length > 0) {
          const { error: lineItemsError } = await supabase
            .from('service_order_line_items' as any)
            .insert(lineItemsToInsert);

          if (lineItemsError) throw lineItemsError;
        }
      }

      // Link to helpdesk ticket
      if (ticket?.id) {
        const { error: linkError } = await supabase
          .from('helpdesk_linked_documents' as any)
          .insert({
            ticket_id: ticket.id,
            entity_type: 'service_order',
            entity_id: (serviceOrder as any).id,
            tenant_id: profile.tenant_id,
          });

        if (linkError) console.error("Error linking ticket:", linkError);
      }

      toast({
        title: "Service order created",
        description: "Service order with line items has been created and linked to this ticket.",
      });

      onSuccess((serviceOrder as any).id);
    } catch (error) {
      console.error("Error creating service order:", error);
      toast({
        title: "Error",
        description: "Failed to create service order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax_amount, total_amount } = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Service order title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the service needed..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_start_date">Preferred Start Date</Label>
              <Input
                id="preferred_start_date"
                type="date"
                value={formData.preferred_start_date}
                onChange={(e) => setFormData({ ...formData, preferred_start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_end_date">Preferred End Date</Label>
              <Input
                id="preferred_end_date"
                type="date"
                value={formData.preferred_end_date}
                onChange={(e) => setFormData({ ...formData, preferred_end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button type="button" onClick={addLineItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <Input
                          type="number"
                          value={item.line_total.toFixed(2)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span className="text-muted-foreground">Tax Rate (%):</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  className="w-20 h-8"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax Amount:</span>
                <span className="font-medium">${tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-1 border-t">
                <span>Total:</span>
                <span>${total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="border-t p-4 flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Order
        </Button>
      </div>
    </form>
  );
}
