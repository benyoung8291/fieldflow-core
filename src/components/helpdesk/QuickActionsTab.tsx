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

  const handleActionClick = (view: ViewType) => {
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
      onClick: () => handleActionClick('invoice'),
      color: "text-orange-600",
      bgColor: "bg-orange-50 hover:bg-orange-100",
    },
    {
      id: "purchase_order",
      label: "Create Purchase Order",
      description: "Generate PO from email content",
      icon: <ShoppingCart className="h-5 w-5" />,
      onClick: () => handleActionClick('purchase_order'),
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100",
    },
    {
      id: "service_order",
      label: "Create Service Order",
      description: "Convert email to service order",
      icon: <ClipboardList className="h-5 w-5" />,
      onClick: () => handleActionClick('service_order'),
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100",
    },
    {
      id: "contact",
      label: "Create Contact",
      description: "Add sender as a contact",
      icon: <User className="h-5 w-5" />,
      onClick: () => handleActionClick('contact'),
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100",
    },
    {
      id: "lead",
      label: "Create Lead",
      description: "Convert to sales lead",
      icon: <Users className="h-5 w-5" />,
      onClick: () => handleActionClick('lead'),
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
        <div className="flex-1 min-h-0">
          <InlineAPInvoiceForm 
            parsedData={null}
            ticket={ticket}
            onSuccess={(id) => handleDocumentCreated('ap_invoice', id)}
            onCancel={() => setCurrentView('menu')}
          />
        </div>
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
        <div className="flex-1 min-h-0">
          <InlinePurchaseOrderForm 
            parsedData={null}
            ticket={ticket}
            onSuccess={(id) => handleDocumentCreated('purchase_order', id)}
            onCancel={() => setCurrentView('menu')}
          />
        </div>
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
        <div className="flex-1 min-h-0">
          <InlineServiceOrderForm 
            parsedData={null}
            ticket={ticket}
            onSuccess={(id) => handleDocumentCreated('service_order', id)}
            onCancel={() => setCurrentView('menu')}
          />
        </div>
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
        <div className="flex-1 min-h-0">
          <InlineContactForm 
            parsedData={null}
            ticket={ticket}
            onSuccess={(id) => handleDocumentCreated('contact', id)}
            onCancel={() => setCurrentView('menu')}
          />
        </div>
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
        <div className="flex-1 min-h-0">
          <InlineLeadForm 
            parsedData={null}
            ticket={ticket}
            onSuccess={(id) => handleDocumentCreated('lead', id)}
            onCancel={() => setCurrentView('menu')}
          />
        </div>
      </div>
    );
  }

  // Default: Show Quick Actions menu
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3">
        <h3 className="font-semibold text-sm">Quick Actions</h3>
        <p className="text-xs text-muted-foreground">
          Create documents from this email
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

    </div>
  );
}
