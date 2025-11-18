import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InlineLineItemRowProps {
  item: any;
  canEdit: boolean;
  onUpdate: () => void;
  onDelete: (itemId: string) => void;
}

export function InlineLineItemRow({ item, canEdit, onUpdate, onDelete }: InlineLineItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [quantity, setQuantity] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(item.unit_price);
  const [notes, setNotes] = useState(item.notes || "");

  const handleSave = async () => {
    try {
      const lineTotal = quantity * unitPrice;
      
      const { error } = await supabase
        .from("purchase_order_line_items")
        .update({
          description,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          notes,
        })
        .eq("id", item.id);

      if (error) throw error;

      toast.success("Line item updated");
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      toast.error("Failed to update line item");
    }
  };

  const handleCancel = () => {
    setDescription(item.description);
    setQuantity(item.quantity);
    setUnitPrice(item.unit_price);
    setNotes(item.notes || "");
    setIsEditing(false);
  };

  if (canEdit && isEditing) {
    return (
      <TableRow>
        <TableCell>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="mt-2 text-sm"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            min="0"
            step="1"
          />
        </TableCell>
        <TableCell>
          <Badge variant={item.quantity_received >= item.quantity ? "default" : "outline"}>
            {item.quantity_received}
          </Badge>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
          />
        </TableCell>
        <TableCell>${(quantity * unitPrice).toFixed(2)}</TableCell>
        <TableCell>
          {item.is_gst_free ? (
            <Badge variant="outline">GST Free</Badge>
          ) : (
            <Badge>Incl. GST</Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button size="sm" variant="default" onClick={handleSave}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow 
      className={canEdit ? "cursor-pointer hover:bg-muted/50" : ""}
      onClick={() => canEdit && setIsEditing(true)}
    >
      <TableCell>
        <div>
          {item.description}
          {item.notes && (
            <div className="text-sm text-muted-foreground">{item.notes}</div>
          )}
        </div>
      </TableCell>
      <TableCell>{item.quantity}</TableCell>
      <TableCell>
        <Badge variant={item.quantity_received >= item.quantity ? "default" : "outline"}>
          {item.quantity_received}
        </Badge>
      </TableCell>
      <TableCell>${item.unit_price?.toFixed(2)}</TableCell>
      <TableCell>${item.line_total?.toFixed(2)}</TableCell>
      <TableCell>
        {item.is_gst_free ? (
          <Badge variant="outline">GST Free</Badge>
        ) : (
          <Badge>Incl. GST</Badge>
        )}
      </TableCell>
      {canEdit && (
        <TableCell>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
