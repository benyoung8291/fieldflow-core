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
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InlineAPInvoiceForm } from "./inline-forms/InlineAPInvoiceForm";
import { InlinePurchaseOrderForm } from "./inline-forms/InlinePurchaseOrderForm";
import { InlineServiceOrderForm } from "./inline-forms/InlineServiceOrderForm";
import { InlineContactForm } from "./inline-forms/InlineContactForm";
import { InlineLeadForm } from "./inline-forms/InlineLeadForm";

interface QuickActionsTabProps {
  ticket: any;
}

type ViewType = 'menu' | 'invoice' | 'purchase_order' | 'service_order' | 'contact' | 'lead';

export function QuickActionsTab({ ticket }: QuickActionsTabProps) {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<ViewType>('menu');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, any>>({});
  const [emailType, setEmailType] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);

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
        if (data.detected_type) {
          setEmailType(data.detected_type);
          setConfidence(data.confidence || 0);
        }
        toast({
          title: "Email parsed successfully",
          description: data.detected_type 
            ? `Detected as ${data.detected_type} (${Math.round(data.confidence * 100)}% confidence)`
            : "Form will be pre-filled with extracted data",
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

  const handleActionClick = async (actionId: string, view: ViewType) => {
    if (!parsedData[actionId]) {
      await parseEmailContent(actionId);
    }
    setCurrentView(view);
  };

  const handleDocumentCreated = async (documentType: string, documentId: string) => {
    // Link the document to the ticket
    try {
      await supabase.from('helpdesk_linked_documents' as any).insert({
        ticket_id: ticket.id,
        document_type: documentType,
        document_id: documentId,
      });
      
      toast({
        title: "Document linked",
        description: "The document has been created and linked to this ticket.",
      });
    } catch (error) {
      console.error("Error linking document:", error);
    }
    
    // Return to menu
    setCurrentView('menu');
  };

  const actions = [
    {
      id: "invoice",
      label: "Create AP Invoice",
      description: "Create an invoice from email attachments",
      icon: <Receipt className="h-5 w-5" />,
      onClick: () => handleActionClick("invoice", 'invoice'),
      color: "text-orange-600",
      bgColor: "bg-orange-50 hover:bg-orange-100",
    },
    {
      id: "purchase_order",
      label: "Create Purchase Order",
      description: "Generate PO from email content",
      icon: <ShoppingCart className="h-5 w-5" />,
      onClick: () => handleActionClick("purchase_order", 'purchase_order'),
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
    },
    {
      id: "service_order",
      label: "Create Service Order",
      description: "Convert email to service order",
      icon: <ClipboardList className="h-5 w-5" />,
      onClick: () => handleActionClick("service_order", 'service_order'),
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
    },
    {
      id: "contact",
      label: "Create Contact",
      description: "Add sender as a contact",
      icon: <User className="h-5 w-5" />,
      onClick: () => handleActionClick("contact", 'contact'),
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100",
    },
    {
      id: "lead",
      label: "Create Lead",
      description: "Convert to sales lead",
      icon: <Users className="h-5 w-5" />,
      onClick: () => handleActionClick("lead", 'lead'),
      color: "text-pink-600",
      bgColor: "bg-pink-50 hover:bg-pink-100",
    },
  ];

  // Extract email content for pre-filling
  const emailContent = ticket?.description || "";
  const senderEmail = ticket?.sender_email || ticket?.contact?.email || ticket?.email_account?.email_address || "";
  const senderName = ticket?.sender_name || 
    (ticket?.contact?.first_name && ticket?.contact?.last_name
      ? `${ticket.contact.first_name} ${ticket.contact.last_name}`
      : "") || "Unknown Sender";

  // Render inline forms based on current view
  if (currentView === 'invoice') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('menu')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quick Actions
          </Button>
          <h3 className="font-semibold text-sm">Create AP Invoice</h3>
        </div>
        <InlineAPInvoiceForm 
          parsedData={parsedData.invoice}
          ticket={ticket}
          onSuccess={(id) => handleDocumentCreated('ap_invoice', id)}
          onCancel={() => setCurrentView('menu')}
        />
      </div>
    );
  }

  if (currentView === 'purchase_order') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('menu')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quick Actions
          </Button>
          <h3 className="font-semibold text-sm">Create Purchase Order</h3>
        </div>
        <InlinePurchaseOrderForm 
          parsedData={parsedData.purchase_order}
          ticket={ticket}
          onSuccess={(id) => handleDocumentCreated('purchase_order', id)}
          onCancel={() => setCurrentView('menu')}
        />
      </div>
    );
  }

  if (currentView === 'service_order') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('menu')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quick Actions
          </Button>
          <h3 className="font-semibold text-sm">Create Service Order</h3>
        </div>
        <InlineServiceOrderForm 
          parsedData={parsedData.service_order}
          ticket={ticket}
          onSuccess={(id) => handleDocumentCreated('service_order', id)}
          onCancel={() => setCurrentView('menu')}
        />
      </div>
    );
  }

  if (currentView === 'contact') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('menu')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quick Actions
          </Button>
          <h3 className="font-semibold text-sm">Create Contact</h3>
        </div>
        <InlineContactForm 
          parsedData={parsedData.contact}
          ticket={ticket}
          onSuccess={(id) => handleDocumentCreated('contact', id)}
          onCancel={() => setCurrentView('menu')}
        />
      </div>
    );
  }

  if (currentView === 'lead') {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('menu')} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quick Actions
          </Button>
          <h3 className="font-semibold text-sm">Create Lead</h3>
        </div>
        <InlineLeadForm 
          parsedData={parsedData.lead}
          ticket={ticket}
          onSuccess={(id) => handleDocumentCreated('lead', id)}
          onCancel={() => setCurrentView('menu')}
        />
      </div>
    );
  }

  // Default: Show Quick Actions menu
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
                  AI is analyzing email patterns and extracting data...
                </p>
              </div>
            </Card>
          )}

          {/* Email Type Detection */}
          {emailType && confidence > 0 && !isParsing && (
            <Card className="p-3 bg-green-50 border-green-200">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-green-900">
                    Detected: {emailType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Confidence: {Math.round(confidence * 100)}%
                  </p>
                </div>
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

    </div>
  );
}
