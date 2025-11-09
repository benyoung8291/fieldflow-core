import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addMonths, addYears, format } from "date-fns";

interface RenewContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: any;
}

export default function RenewContractDialog({ open, onOpenChange, contract }: RenewContractDialogProps) {
  const queryClient = useQueryClient();
  const [renewalType, setRenewalType] = useState<"extend" | "new">("extend");
  const [extensionMonths, setExtensionMonths] = useState("12");
  const [newStartDate, setNewStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newEndDate, setNewEndDate] = useState(format(addYears(new Date(), 1), "yyyy-MM-dd"));
  const [adjustmentPercentage, setAdjustmentPercentage] = useState("0");
  const [notes, setNotes] = useState("");

  const renewMutation = useMutation({
    mutationFn: async () => {
      if (renewalType === "extend") {
        // Extend existing contract
        const currentEndDate = new Date(contract.end_date);
        const newEnd = addMonths(currentEndDate, parseInt(extensionMonths));

        const { error } = await supabase
          .from("service_contracts" as any)
          .update({
            end_date: format(newEnd, "yyyy-MM-dd"),
            notes: notes || contract.notes,
          })
          .eq("id", contract.id);

        if (error) throw error;

        // Optionally adjust line item prices
        if (parseFloat(adjustmentPercentage) !== 0) {
          const { data: lineItems } = await supabase
            .from("service_contract_line_items" as any)
            .select("*")
            .eq("contract_id", contract.id);

          if (lineItems) {
            const adjustmentMultiplier = 1 + parseFloat(adjustmentPercentage) / 100;
            
            for (const item of lineItems as any[]) {
              const newUnitPrice = parseFloat(item.unit_price) * adjustmentMultiplier;
              const newLineTotal = newUnitPrice * parseFloat(item.quantity);

              await supabase
                .from("service_contract_line_items" as any)
                .update({
                  unit_price: newUnitPrice,
                  line_total: newLineTotal,
                })
                .eq("id", item.id);
            }

            // Update total contract value
            const newTotal = (lineItems as any[]).reduce((sum: number, item: any) => {
              const newPrice = parseFloat(item.unit_price) * adjustmentMultiplier * parseFloat(item.quantity);
              return sum + newPrice;
            }, 0);

            await supabase
              .from("service_contracts" as any)
              .update({ total_contract_value: newTotal })
              .eq("id", contract.id);
          }
        }

        return { type: "extend" };
      } else {
        // Create new contract
        const adjustmentMultiplier = 1 + parseFloat(adjustmentPercentage) / 100;

        // Get existing line items
        const { data: existingLineItems } = await supabase
          .from("service_contract_line_items" as any)
          .select("*")
          .eq("contract_id", contract.id);

        // Calculate new total
        const newTotal = (existingLineItems as any[] | null)?.reduce((sum: number, item: any) => {
          const newPrice = parseFloat(item.unit_price) * adjustmentMultiplier * parseFloat(item.quantity);
          return sum + newPrice;
        }, 0) || 0;

        // Generate new contract number
        const { data: latestContract } = await supabase
          .from("service_contracts" as any)
          .select("contract_number")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastNumber = (latestContract as any)?.contract_number?.match(/\d+$/)?.[0] || "0";
        const newNumber = `SC-${String(parseInt(lastNumber) + 1).padStart(5, "0")}`;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Get tenant_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (!profile?.tenant_id) throw new Error("No tenant found");

        // Create new contract
        const { data: newContract, error: contractError } = await supabase
          .from("service_contracts" as any)
          .insert({
            tenant_id: profile.tenant_id,
            customer_id: contract.customer_id,
            contract_number: newNumber,
            title: `${contract.title} (Renewed)`,
            description: contract.description,
            start_date: newStartDate,
            end_date: newEndDate,
            billing_frequency: contract.billing_frequency,
            total_contract_value: newTotal,
            status: "active",
            auto_generate: contract.auto_generate,
            notes: notes || `Renewed from contract ${contract.contract_number}`,
            created_by: user.id,
          })
          .select()
          .single();

        if (contractError) throw contractError;
        if (!newContract) throw new Error("Failed to create contract");

        // Copy line items with adjusted prices
        if (existingLineItems) {
          const newLineItems = (existingLineItems as any[]).map((item: any) => {
            const newUnitPrice = parseFloat(item.unit_price) * adjustmentMultiplier;
            const newLineTotal = newUnitPrice * parseFloat(item.quantity);

            return {
              contract_id: (newContract as any).id,
              description: item.description,
              quantity: item.quantity,
              unit_price: newUnitPrice,
              line_total: newLineTotal,
              item_order: item.item_order,
              recurrence_frequency: item.recurrence_frequency,
              first_generation_date: newStartDate,
              next_generation_date: newStartDate,
              generation_day_of_week: item.generation_day_of_week,
              generation_day_of_month: item.generation_day_of_month,
              is_active: item.is_active,
              notes: item.notes,
            };
          });

          const { error: lineItemsError } = await supabase
            .from("service_contract_line_items" as any)
            .insert(newLineItems);

          if (lineItemsError) throw lineItemsError;
        }

        // Mark old contract as expired
        await supabase
          .from("service_contracts" as any)
          .update({ status: "expired" })
          .eq("id", contract.id);

        return { type: "new", contractId: (newContract as any).id };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["service-contracts-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["service-contract", contract.id] });
      
      if (result.type === "extend") {
        toast.success("Contract extended successfully");
      } else {
        toast.success("New contract created successfully");
      }
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to renew contract: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Renew Contract</DialogTitle>
          <DialogDescription>
            Extend the existing contract or create a new one with updated terms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Renewal Type</Label>
            <Select value={renewalType} onValueChange={(value: any) => setRenewalType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="extend">Extend Existing Contract</SelectItem>
                <SelectItem value="new">Create New Contract</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {renewalType === "extend"
                ? "Extend the end date of the current contract"
                : "Create a new contract and mark the old one as expired"}
            </p>
          </div>

          {renewalType === "extend" ? (
            <div className="space-y-2">
              <Label>Extension Period (Months)</Label>
              <Select value={extensionMonths} onValueChange={setExtensionMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                  <SelectItem value="24">24 Months</SelectItem>
                  <SelectItem value="36">36 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Start Date</Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>New End Date</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Price Adjustment (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={adjustmentPercentage}
              onChange={(e) => setAdjustmentPercentage(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Enter a percentage to adjust all line item prices (e.g., 5 for 5% increase, -10 for 10% decrease)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this renewal..."
              rows={3}
            />
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium">Current Contract Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Contract Number:</span>
                <span className="ml-2 font-medium">{contract.contract_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Current Value:</span>
                <span className="ml-2 font-medium">
                  ${parseFloat(contract.total_contract_value).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">End Date:</span>
                <span className="ml-2 font-medium">
                  {format(new Date(contract.end_date), "PP")}
                </span>
              </div>
              {parseFloat(adjustmentPercentage) !== 0 && (
                <div>
                  <span className="text-muted-foreground">New Value:</span>
                  <span className="ml-2 font-medium">
                    $
                    {(
                      parseFloat(contract.total_contract_value) *
                      (1 + parseFloat(adjustmentPercentage) / 100)
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => renewMutation.mutate()} disabled={renewMutation.isPending}>
            {renewMutation.isPending ? "Processing..." : "Renew Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
