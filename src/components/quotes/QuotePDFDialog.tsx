import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface QuotePDFDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  customerEmail?: string;
}

export default function QuotePDFDialog({ open, onOpenChange, quoteId, customerEmail }: QuotePDFDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSubItems, setShowSubItems] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default");
  const [emailMode, setEmailMode] = useState(false);
  const [emailData, setEmailData] = useState({
    to: customerEmail || "",
    subject: "Your Quotation",
    message: "Please find attached your quotation. If you have any questions, please don't hesitate to contact us.",
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_templates")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
          quote_id: quoteId,
          template_id: selectedTemplate === "default" ? null : selectedTemplate,
          show_sub_items: showSubItems,
        },
      });

      if (error) throw error;

      // For now, open HTML in new tab (in production, would download PDF)
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(data.html);
        newWindow.document.close();
      }

      toast.success("PDF generated successfully");
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailData.to) {
      toast.error("Please enter an email address");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // First generate PDF
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-quote-pdf', {
        body: {
          quote_id: quoteId,
          template_id: selectedTemplate === "default" ? null : selectedTemplate,
          show_sub_items: showSubItems,
        },
      });

      if (pdfError) throw pdfError;

      // Then send email
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: {
          quote_id: quoteId,
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.message,
          pdf_html: pdfData.html,
        },
      });

      if (error) throw error;

      toast.success(`Quote sent to ${emailData.to}`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{emailMode ? "Email Quote" : "Generate PDF"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>PDF Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select template (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Template</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="show_sub_items">Show Sub-items in PDF</Label>
            <Switch
              id="show_sub_items"
              checked={showSubItems}
              onCheckedChange={setShowSubItems}
            />
          </div>

          {emailMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email_to">To *</Label>
                <Input
                  id="email_to"
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_subject">Subject *</Label>
                <Input
                  id="email_subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_message">Message *</Label>
                <Textarea
                  id="email_message"
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  rows={6}
                />
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!emailMode && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEmailMode(true)}
                >
                  Email Instead
                </Button>
                <Button onClick={handleGeneratePDF} disabled={generating}>
                  {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate PDF
                </Button>
              </>
            )}
            {emailMode && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEmailMode(false)}
                >
                  Back to PDF
                </Button>
                <Button onClick={handleSendEmail} disabled={sending}>
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Email
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}