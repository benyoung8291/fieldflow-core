import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EditInvoiceLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItem: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    source_type?: string;
    source_id?: string;
    line_item_id?: string;
  };
  onSave: (updatedItem: any) => void;
  isFromSource: boolean;
}

export default function EditInvoiceLineDialog({
  open,
  onOpenChange,
  lineItem,
  onSave,
  isFromSource,
}: EditInvoiceLineDialogProps) {
  const [description, setDescription] = useState(lineItem.description);
  const [quantity, setQuantity] = useState(lineItem.quantity.toString());
  const [unitPrice, setUnitPrice] = useState(lineItem.unit_price.toString());
  const [showWarning, setShowWarning] = useState(false);

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return (qty * price).toFixed(2);
  };

  const handleSave = () => {
    if (isFromSource && !showWarning) {
      setShowWarning(true);
      return;
    }

    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    
    onSave({
      ...lineItem,
      description,
      quantity: qty,
      unit_price: price,
      line_total: qty * price,
    });
    
    onOpenChange(false);
    setShowWarning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Line Item</DialogTitle>
          <DialogDescription>
            Update the details for this invoice line item
          </DialogDescription>
        </DialogHeader>

        {showWarning && isFromSource && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This line item was imported from a {lineItem.source_type?.replace('_', ' ')}. 
              Changes made here will differ from the source document and will be logged in the change history.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Line Total:</span>
            <span className="text-lg font-bold">${calculateTotal()}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            onOpenChange(false);
            setShowWarning(false);
          }}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {showWarning ? "Confirm Changes" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
