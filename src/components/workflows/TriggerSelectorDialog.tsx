import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import {
  Mail,
  FileText,
  Wrench,
  ShoppingCart,
  Receipt,
  Users,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TriggerSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTrigger: string;
  onSelect: (triggerType: string) => void;
}

const triggerCategories = [
  {
    name: "Sales & Quotes",
    icon: FileText,
    triggers: [
      { value: "quote_created", label: "Quote Created" },
      { value: "quote_approved", label: "Quote Approved" },
      { value: "quote_sent", label: "Quote Sent" },
    ],
  },
  {
    name: "Invoices & Finance",
    icon: Receipt,
    triggers: [
      { value: "invoice_sent", label: "Invoice Sent" },
      { value: "expense_submitted", label: "Expense Submitted" },
      { value: "expense_approved", label: "Expense Approved" },
    ],
  },
  {
    name: "Helpdesk & Support",
    icon: Mail,
    triggers: [
      { value: "ticket_created", label: "Ticket Created" },
      { value: "ticket_assigned", label: "Ticket Assigned" },
      { value: "ticket_status_changed", label: "Ticket Status Changed" },
      { value: "ticket_resolved", label: "Ticket Resolved" },
      { value: "ticket_reopened", label: "Ticket Reopened" },
      { value: "email_received", label: "Email Received" },
      { value: "email_sent", label: "Email Sent" },
    ],
  },
  {
    name: "Projects & Service",
    icon: Wrench,
    triggers: [
      { value: "project_created", label: "Project Created" },
      { value: "service_order_completed", label: "Service Order Completed" },
    ],
  },
  {
    name: "Purchase Orders",
    icon: ShoppingCart,
    triggers: [
      { value: "purchase_order_created", label: "Purchase Order Created" },
      { value: "purchase_order_approved", label: "Purchase Order Approved" },
    ],
  },
];

export default function TriggerSelectorDialog({
  open,
  onOpenChange,
  currentTrigger,
  onSelect,
}: TriggerSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a Trigger</DialogTitle>
          <DialogDescription>
            Select what event should start this workflow
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {triggerCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.name}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">{category.name}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {category.triggers.map((trigger) => (
                    <Card
                      key={trigger.value}
                      className={cn(
                        "p-3 cursor-pointer hover:bg-accent transition-colors",
                        currentTrigger === trigger.value && "ring-2 ring-primary"
                      )}
                      onClick={() => onSelect(trigger.value)}
                    >
                      <div className="text-sm font-medium">{trigger.label}</div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
