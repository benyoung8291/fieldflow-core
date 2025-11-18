import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface InlinePurchaseOrderFormProps {
  parsedData?: any;
  ticket: any;
  onSuccess: (id: string) => void;
  onCancel: () => void;
}

export function InlinePurchaseOrderForm({ parsedData, ticket, onSuccess, onCancel }: InlinePurchaseOrderFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    po_number: parsedData?.po_number || "",
    vendor_name: parsedData?.vendor_name || "",
    order_date: parsedData?.order_date || new Date().toISOString().split('T')[0],
    expected_delivery: parsedData?.expected_delivery || "",
    description: parsedData?.description || ticket?.description || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get tenant and user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Use RPC function to create PO without schema cache issues
      const { data: poId, error } = await supabase.rpc('create_purchase_order_with_linkage', {
        p_tenant_id: profile.tenant_id,
        p_supplier_id: null, // Will need to be set later
        p_po_number: formData.po_number,
        p_po_date: formData.order_date,
        p_expected_delivery_date: formData.expected_delivery || null,
        p_notes: formData.description || '',
        p_internal_notes: '',
        p_tax_rate: 10,
        p_subtotal: 0,
        p_tax_amount: 0,
        p_total_amount: 0,
        p_created_by: user.id,
        p_status: 'draft',
        p_service_order_id: null,
        p_project_id: null
      });

      if (error) throw error;

      toast({
        title: "Purchase order created",
        description: "PO has been created successfully.",
      });

      onSuccess(poId);
    } catch (error) {
      console.error("Error creating PO:", error);
      toast({
        title: "Error",
        description: "Failed to create purchase order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="po_number">PO Number *</Label>
            <Input
              id="po_number"
              required
              value={formData.po_number}
              onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
              placeholder="PO-001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_name">Vendor Name</Label>
            <Input
              id="vendor_name"
              value={formData.vendor_name}
              onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
              placeholder="Enter vendor name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="order_date">Order Date *</Label>
              <Input
                id="order_date"
                type="date"
                required
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery">Expected Delivery</Label>
              <Input
                id="expected_delivery"
                type="date"
                value={formData.expected_delivery}
                onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Order details..."
              rows={4}
            />
          </div>
        </div>
      </ScrollArea>

      <div className="border-t p-4 flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create PO
        </Button>
      </div>
    </form>
  );
}
