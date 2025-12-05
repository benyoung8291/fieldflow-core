import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { ChartOfAccountsSelector } from "@/components/expenses/ChartOfAccountsSelector";
import { supabase } from "@/integrations/supabase/client";

interface AddInvoiceLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (newItem: any) => void;
}

export default function AddInvoiceLineDialog({
  open,
  onOpenChange,
  onAdd,
}: AddInvoiceLineDialogProps) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [accountCode, setAccountCode] = useState("");
  const [subAccount, setSubAccount] = useState("");

  // Fetch default sales account from integration settings
  const { data: integrationSettings } = useQuery({
    queryKey: ["accounting-integration-defaults"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      
      if (!profile?.tenant_id) return null;

      const { data } = await supabase
        .from("accounting_integrations")
        .select("default_sales_account_code, default_sales_sub_account")
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", "myob_acumatica")
        .eq("is_enabled", true)
        .maybeSingle();
      
      return data;
    },
  });

  // Apply defaults when dialog opens
  useEffect(() => {
    if (open && integrationSettings) {
      setAccountCode(integrationSettings.default_sales_account_code || "");
      setSubAccount(integrationSettings.default_sales_sub_account || "");
    }
  }, [open, integrationSettings]);

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return formatCurrency(qty * price);
  };

  const handleAdd = () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    
    onAdd({
      description,
      quantity: qty,
      unit_price: price,
      line_total: qty * price,
      account_code: accountCode,
      sub_account: subAccount,
    });
    
    // Reset form
    setDescription("");
    setQuantity("1");
    setUnitPrice("0");
    setAccountCode("");
    setSubAccount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
          <DialogDescription>
            Add a new line item to this invoice
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter item description..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <ChartOfAccountsSelector
              accountCode={accountCode}
              subAccount={subAccount}
              onAccountChange={setAccountCode}
              onSubAccountChange={setSubAccount}
            />
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Line Total:</span>
            <span className="text-lg font-bold">${calculateTotal()}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!description.trim()}>
            Add Line Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
