import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChartOfAccountsSelector } from "@/components/expenses/ChartOfAccountsSelector";
import { formatCurrency } from "@/lib/utils";

interface InlineInvoiceLineItemRowProps {
  item: any;
  sourceDoc: any;
  canEdit: boolean;
  onUpdate: () => void;
  onDelete: (itemId: string) => void;
  onSourceClick: (sourceDoc: any) => void;
}

export function InlineInvoiceLineItemRow({ 
  item, 
  sourceDoc,
  canEdit, 
  onUpdate, 
  onDelete,
  onSourceClick 
}: InlineInvoiceLineItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [quantity, setQuantity] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(item.unit_price);
  const [accountCode, setAccountCode] = useState(item.account_code || "");
  const [subAccount, setSubAccount] = useState(item.sub_account || "");

  const handleSave = async () => {
    try {
      const lineTotal = quantity * unitPrice;
      
      const { error } = await supabase
        .from("invoice_line_items")
        .update({
          description,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          account_code: accountCode,
          sub_account: subAccount,
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
    setAccountCode(item.account_code || "");
    setSubAccount(item.sub_account || "");
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
          {sourceDoc && (
            <div className="text-xs text-muted-foreground mt-1">
              {sourceDoc.type === "project" 
                ? `from Project: ${sourceDoc.name}`
                : `from ${sourceDoc.order_number} - ${sourceDoc.title}`
              }
            </div>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {sourceDoc?.type === "service_order" && sourceDoc.work_order_number
            ? sourceDoc.work_order_number
            : "-"}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {sourceDoc?.type === "service_order" && sourceDoc.purchase_order_number
            ? sourceDoc.purchase_order_number
            : "-"}
        </TableCell>
        <TableCell colSpan={2}>
          <ChartOfAccountsSelector
            accountCode={accountCode}
            subAccount={subAccount}
            onAccountChange={setAccountCode}
            onSubAccountChange={setSubAccount}
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-20"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
            className="w-24"
          />
        </TableCell>
        <TableCell className="text-right font-medium">
          {formatCurrency(quantity * unitPrice)}
        </TableCell>
        <TableCell>
          <div className="flex gap-1 justify-end">
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
          <div>{item.description}</div>
          {sourceDoc && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSourceClick(sourceDoc);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground mt-1 hover:text-primary transition-colors group"
            >
              {sourceDoc.type === "project" ? (
                <>
                  <span>from Project: {sourceDoc.name}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              ) : (
                <>
                  <span>from {sourceDoc.order_number} - {sourceDoc.title}</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {sourceDoc?.type === "service_order" && sourceDoc.work_order_number
          ? sourceDoc.work_order_number
          : "-"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {sourceDoc?.type === "service_order" && sourceDoc.purchase_order_number
          ? sourceDoc.purchase_order_number
          : "-"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {item.account_code || "-"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {item.sub_account || "-"}
      </TableCell>
      <TableCell className="text-right">{item.quantity}</TableCell>
      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(item.line_total)}
      </TableCell>
      {canEdit && (
        <TableCell>
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
