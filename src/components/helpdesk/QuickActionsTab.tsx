import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Receipt, 
  ClipboardList, 
  User, 
  Users, 
  ShoppingCart,
  Loader2 
} from "lucide-react";
import APInvoiceDialog from "@/components/invoices/APInvoiceDialog";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";
import QuickContactDialog from "@/components/customers/QuickContactDialog";
import LeadDialog from "@/components/leads/LeadDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface QuickActionsTabProps {
  ticket: any;
}

export function QuickActionsTab({ ticket }: QuickActionsTabProps) {
  const [showAPInvoiceDialog, setShowAPInvoiceDialog] = useState(false);
  const [showPODialog, setShowPODialog] = useState(false);
  const [showServiceOrderDialog, setShowServiceOrderDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);

  const actions = [
    {
      id: "ap-invoice",
      label: "Create AP Invoice",
      description: "Create an invoice from email attachments",
      icon: <Receipt className="h-5 w-5" />,
      onClick: () => setShowAPInvoiceDialog(true),
      color: "text-orange-600",
      bgColor: "bg-orange-50 hover:bg-orange-100",
    },
    {
      id: "purchase-order",
      label: "Create Purchase Order",
      description: "Generate PO from email content",
      icon: <ShoppingCart className="h-5 w-5" />,
      onClick: () => setShowPODialog(true),
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
    },
    {
      id: "service-order",
      label: "Create Service Order",
      description: "Convert email to service order",
      icon: <ClipboardList className="h-5 w-5" />,
      onClick: () => setShowServiceOrderDialog(true),
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
    },
    {
      id: "contact",
      label: "Create Contact",
      description: "Add sender as a contact",
      icon: <User className="h-5 w-5" />,
      onClick: () => setShowContactDialog(true),
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100",
    },
    {
      id: "lead",
      label: "Create Lead",
      description: "Convert to sales lead",
      icon: <Users className="h-5 w-5" />,
      onClick: () => setShowLeadDialog(true),
      color: "text-pink-600",
      bgColor: "bg-pink-50 hover:bg-pink-100",
    },
  ];

  // Extract email content for pre-filling
  const emailContent = ticket?.description || "";
  const senderEmail = ticket?.contact?.email || ticket?.from_email;
  const senderName = ticket?.contact?.first_name && ticket?.contact?.last_name
    ? `${ticket.contact.first_name} ${ticket.contact.last_name}`
    : ticket?.from_name || "";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3">
        <h3 className="font-semibold text-sm mb-1">Quick Actions</h3>
        <p className="text-xs text-muted-foreground">
          Create entities from this email
        </p>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* Email Info Summary */}
          <Card className="p-3 bg-muted/30">
            <p className="text-xs font-medium mb-2">Email Details</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium">From:</span> {senderName || "Unknown"}</p>
              <p><span className="font-medium">Email:</span> {senderEmail || "N/A"}</p>
              <p><span className="font-medium">Subject:</span> {ticket?.subject || "No subject"}</p>
              {ticket?.customer && (
                <p><span className="font-medium">Customer:</span> {ticket.customer.name}</p>
              )}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${action.bgColor}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${action.color}`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {action.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Attachments Info */}
          {ticket?.attachments && ticket.attachments.length > 0 && (
            <Card className="p-3 bg-blue-50/50 border-blue-200">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-900">
                    {ticket.attachments.length} Attachment{ticket.attachments.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Attachments will be available when creating documents
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Dialogs - simplified without initialData */}
      {showAPInvoiceDialog && (
        <APInvoiceDialog
          open={showAPInvoiceDialog}
          onOpenChange={setShowAPInvoiceDialog}
        />
      )}

      {showPODialog && (
        <PurchaseOrderDialog
          open={showPODialog}
          onOpenChange={setShowPODialog}
        />
      )}

      {showServiceOrderDialog && (
        <ServiceOrderDialog
          open={showServiceOrderDialog}
          onOpenChange={setShowServiceOrderDialog}
        />
      )}

      {showContactDialog && (
        <QuickContactDialog
          open={showContactDialog}
          onOpenChange={setShowContactDialog}
          customerId={ticket?.customer_id}
          onContactCreated={() => setShowContactDialog(false)}
        />
      )}

      {showLeadDialog && (
        <LeadDialog
          open={showLeadDialog}
          onOpenChange={setShowLeadDialog}
        />
      )}
    </div>
  );
}
