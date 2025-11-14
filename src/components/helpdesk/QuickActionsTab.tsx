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
  Loader2,
  Sparkles
} from "lucide-react";
import APInvoiceDialog from "@/components/invoices/APInvoiceDialog";
import { PurchaseOrderDialog } from "@/components/purchase-orders/PurchaseOrderDialog";
import ServiceOrderDialog from "@/components/service-orders/ServiceOrderDialog";
import QuickContactDialog from "@/components/customers/QuickContactDialog";
import LeadDialog from "@/components/leads/LeadDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuickActionsTabProps {
  ticket: any;
}

export function QuickActionsTab({ ticket }: QuickActionsTabProps) {
  const { toast } = useToast();
  const [showAPInvoiceDialog, setShowAPInvoiceDialog] = useState(false);
  const [showPODialog, setShowPODialog] = useState(false);
  const [showServiceOrderDialog, setShowServiceOrderDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, any>>({});

  const parseEmailContent = async (extractionType: string) => {
    setIsParsing(true);
    try {
      const emailContent = `
Subject: ${ticket?.subject || "No subject"}
From: ${senderName} <${senderEmail || "no-email@example.com"}>
${ticket?.customer ? `Customer: ${ticket.customer.name}` : ""}

${ticket?.description || ""}
      `.trim();

      console.log("Parsing email with content:", emailContent);

      const { data, error } = await supabase.functions.invoke("parse-email-content", {
        body: { emailContent, extractionType },
      });

      console.log("Parse response:", { data, error });

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }

      if (data?.success) {
        setParsedData((prev) => ({ ...prev, [extractionType]: data.data }));
        toast({
          title: "Email parsed successfully",
          description: "Form will be pre-filled with extracted data",
        });
      } else {
        throw new Error(data?.error || "Failed to parse email");
      }
    } catch (error) {
      console.error("Error parsing email:", error);
      toast({
        title: "Parsing failed",
        description: error instanceof Error ? error.message : "Could not extract data from email. You can still fill the form manually.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleActionClick = async (actionId: string, openDialog: () => void) => {
    if (!parsedData[actionId]) {
      await parseEmailContent(actionId);
    }
    openDialog();
  };

  const actions = [
    {
      id: "invoice",
      label: "Create AP Invoice",
      description: "Create an invoice from email attachments",
      icon: <Receipt className="h-5 w-5" />,
      onClick: () => handleActionClick("invoice", () => setShowAPInvoiceDialog(true)),
      color: "text-orange-600",
      bgColor: "bg-orange-50 hover:bg-orange-100",
    },
    {
      id: "purchase_order",
      label: "Create Purchase Order",
      description: "Generate PO from email content",
      icon: <ShoppingCart className="h-5 w-5" />,
      onClick: () => handleActionClick("purchase_order", () => setShowPODialog(true)),
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
    },
    {
      id: "service_order",
      label: "Create Service Order",
      description: "Convert email to service order",
      icon: <ClipboardList className="h-5 w-5" />,
      onClick: () => handleActionClick("service_order", () => setShowServiceOrderDialog(true)),
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
    },
    {
      id: "contact",
      label: "Create Contact",
      description: "Add sender as a contact",
      icon: <User className="h-5 w-5" />,
      onClick: () => handleActionClick("contact", () => setShowContactDialog(true)),
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100",
    },
    {
      id: "lead",
      label: "Create Lead",
      description: "Convert to sales lead",
      icon: <Users className="h-5 w-5" />,
      onClick: () => handleActionClick("lead", () => setShowLeadDialog(true)),
      color: "text-pink-600",
      bgColor: "bg-pink-50 hover:bg-pink-100",
    },
  ];

  // Extract email content for pre-filling
  const emailContent = ticket?.description || "";
  const senderEmail = ticket?.contact?.email || ticket?.from_email || "";
  const senderName = ticket?.contact?.first_name && ticket?.contact?.last_name
    ? `${ticket.contact.first_name} ${ticket.contact.last_name}`
    : ticket?.from_name || "Unknown Sender";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-sm">Quick Actions</h3>
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-xs text-muted-foreground">
          AI will extract data and pre-fill forms
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

          {/* AI Parsing Status */}
          {isParsing && (
            <Card className="p-3 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <p className="text-xs font-medium text-primary">
                  AI is analyzing email content...
                </p>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                disabled={isParsing}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${action.bgColor} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${action.color}`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{action.label}</p>
                      {parsedData[action.id] && (
                        <Sparkles className="h-3 w-3 text-primary" />
                      )}
                    </div>
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
