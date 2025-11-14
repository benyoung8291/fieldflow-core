import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  Mail, 
  CheckSquare, 
  ShoppingCart, 
  DollarSign,
  Ticket
} from "lucide-react";

interface TriggerSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (triggerType: string) => void;
  currentTrigger?: string;
}

const triggerCategories = [
  {
    category: "Sales & Quotes",
    icon: DollarSign,
    triggers: [
      { value: "quote_created", label: "Quote Created", description: "When a new quote is created" },
      { value: "quote_approved", label: "Quote Approved", description: "When a quote is approved" },
      { value: "quote_sent", label: "Quote Sent", description: "When a quote is sent to customer" },
    ]
  },
  {
    category: "Invoices & Finance",
    icon: FileText,
    triggers: [
      { value: "invoice_sent", label: "Invoice Sent", description: "When an invoice is sent" },
      { value: "expense_submitted", label: "Expense Submitted", description: "When an expense is submitted" },
      { value: "expense_approved", label: "Expense Approved", description: "When an expense is approved" },
    ]
  },
  {
    category: "Helpdesk & Support",
    icon: Ticket,
    triggers: [
      { value: "ticket_created", label: "Ticket Created", description: "When a helpdesk ticket is created" },
      { value: "ticket_assigned", label: "Ticket Assigned", description: "When a ticket is assigned to a user" },
      { value: "ticket_status_changed", label: "Ticket Status Changed", description: "When a ticket status changes" },
      { value: "ticket_resolved", label: "Ticket Resolved", description: "When a ticket is resolved" },
      { value: "ticket_reopened", label: "Ticket Reopened", description: "When a closed ticket is reopened" },
      { value: "email_received", label: "Email Received", description: "When an email is received in helpdesk" },
      { value: "email_sent", label: "Email Sent", description: "When an email is sent from helpdesk" },
    ]
  },
  {
    category: "Projects & Service",
    icon: CheckSquare,
    triggers: [
      { value: "project_created", label: "Project Created", description: "When a new project is created" },
      { value: "service_order_completed", label: "Service Order Completed", description: "When a service order is marked complete" },
    ]
  },
  {
    category: "Purchase Orders",
    icon: ShoppingCart,
    triggers: [
      { value: "purchase_order_created", label: "Purchase Order Created", description: "When a purchase order is created" },
      { value: "purchase_order_approved", label: "Purchase Order Approved", description: "When a purchase order is approved" },
    ]
  },
];

export default function TriggerSelectorDialog({ 
  open, 
  onOpenChange, 
  onSelect,
  currentTrigger 
}: TriggerSelectorDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Select Workflow Trigger</DialogTitle>
          <DialogDescription>
            Choose what event will start this workflow
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {triggerCategories.map((category) => {
            const CategoryIcon = category.icon;
            const isExpanded = selectedCategory === category.category;
            
            return (
              <div key={category.category} className="space-y-2">
                <button
                  onClick={() => setSelectedCategory(isExpanded ? null : category.category)}
                  className="w-full"
                >
                  <Card className="p-4 hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <CategoryIcon className="h-5 w-5 text-primary" />
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold">{category.category}</h3>
                        <p className="text-sm text-muted-foreground">
                          {category.triggers.length} trigger{category.triggers.length !== 1 ? 's' : ''} available
                        </p>
                      </div>
                    </div>
                  </Card>
                </button>
                
                {isExpanded && (
                  <div className="pl-4 space-y-2">
                    {category.triggers.map((trigger) => (
                      <Card
                        key={trigger.value}
                        className={`p-4 cursor-pointer hover:border-primary transition-colors ${
                          currentTrigger === trigger.value ? 'border-primary bg-accent' : ''
                        }`}
                        onClick={() => {
                          onSelect(trigger.value);
                          onOpenChange(false);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{trigger.label}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {trigger.description}
                            </p>
                          </div>
                          {currentTrigger === trigger.value && (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
