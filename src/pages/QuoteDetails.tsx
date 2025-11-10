import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DocumentDetailLayout, {
  DocumentAction,
  FileMenuAction,
  StatusBadge,
  TabConfig,
} from "@/components/layout/DocumentDetailLayout";
import KeyInfoCard from "@/components/layout/KeyInfoCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  Download,
  Lock,
  Mail,
  RefreshCw,
  Trash2,
  User,
  DollarSign,
  ListChecks,
  TrendingUp,
  History,
} from "lucide-react";
import QuoteDialog from "@/components/quotes/QuoteDialog";
import QuotePDFDialog from "@/components/quotes/QuotePDFDialog";
import ConvertQuoteDialog from "@/components/quotes/ConvertQuoteDialog";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import AuditTimeline from "@/components/audit/AuditTimeline";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function QuoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data: quoteData, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const { data: customer } = await supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", quoteData.customer_id)
        .single();

      const { data: creator } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", quoteData.created_by)
        .single();

      return { ...quoteData, customer, creator };
    },
  });

  const { data: lineItems } = useQuery({
    queryKey: ["quote-line-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", id)
        .order("item_order");

      if (error) throw error;
      return data;
    },
  });

  const { data: attachments } = useQuery({
    queryKey: ["quote-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_attachments")
        .select("*")
        .eq("quote_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines" as any)
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch stages for selected pipeline
  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages", quote?.pipeline_id],
    queryFn: async () => {
      if (!quote?.pipeline_id) return [];

      const { data, error } = await supabase
        .from("crm_status_settings")
        .select("*")
        .eq("pipeline_id", quote.pipeline_id)
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!quote?.pipeline_id,
  });

  const handleDownloadAttachment = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('quote-attachments')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error downloading file",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const updates: any = { status: newStatus };

      if (newStatus === "sent") updates.sent_at = new Date().toISOString();
      if (newStatus === "approved") updates.approved_at = new Date().toISOString();
      if (newStatus === "rejected") updates.rejected_at = new Date().toISOString();

      const { error } = await supabase.from("quotes").update(updates).eq("id", id);

      if (error) throw error;

      toast({ title: `Quote ${newStatus} successfully` });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error: any) {
      toast({
        title: "Error updating quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updatePipelineStage = async (field: 'pipeline_id' | 'stage_id', value: string) => {
    try {
      const updates: any = { [field]: value };
      
      // If updating pipeline, reset stage
      if (field === 'pipeline_id') {
        updates.stage_id = null;
      }

      const { error } = await supabase.from("quotes").update(updates).eq("id", id);

      if (error) throw error;

      toast({ title: `Quote ${field === 'pipeline_id' ? 'pipeline' : 'stage'} updated` });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error: any) {
      toast({
        title: "Error updating quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("quotes").delete().eq("id", id);

      if (error) throw error;

      toast({ title: "Quote deleted successfully" });
      navigate("/quotes");
    } catch (error: any) {
      toast({
        title: "Error deleting quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Status badges
  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    sent: "default",
    approved: "default",
    rejected: "destructive",
    expired: "outline",
    converted: "default",
  };

  const statusBadges: StatusBadge[] = [
    {
      label: quote?.status || "",
      variant: statusColors[quote?.status || "draft"],
    },
  ];

  // File menu actions
  const fileMenuActions: FileMenuAction[] = [
    {
      label: "Edit Quote",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => setDialogOpen(true),
    },
    {
      label: "PDF / Email",
      icon: <Mail className="h-4 w-4" />,
      onClick: () => setPdfDialogOpen(true),
    },
    ...(quote?.status === "draft" ? [{
      label: "Mark as Sent",
      icon: <Send className="h-4 w-4" />,
      onClick: () => updateStatus("sent"),
      separator: true,
    }] : []),
    ...(quote?.status === "sent" ? [
      {
        label: "Approve Quote",
        icon: <CheckCircle className="h-4 w-4" />,
        onClick: () => updateStatus("approved"),
        separator: true,
      },
      {
        label: "Reject Quote",
        icon: <XCircle className="h-4 w-4" />,
        onClick: () => updateStatus("rejected"),
      },
    ] : []),
    ...((quote?.status === "approved" || quote?.status === "sent") &&
      !quote?.converted_to_service_order_id &&
      !quote?.converted_to_project_id &&
      !quote?.converted_to_contract_id ? [{
        label: "Convert Quote",
        icon: <RefreshCw className="h-4 w-4" />,
        onClick: () => setConvertDialogOpen(true),
        separator: true,
      }] : []),
    {
      label: "Delete Quote",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => setDeleteDialogOpen(true),
      destructive: true,
      separator: true,
    },
  ];

  // Key info section
  const keyInfoSection = quote && (
    <div className="grid gap-4 md:grid-cols-4">
      <KeyInfoCard
        icon={User}
        label="Customer"
        value={quote.customer?.name || "N/A"}
      />
      <KeyInfoCard
        icon={FileText}
        label="Quote Number"
        value={quote.quote_number}
      />
      <KeyInfoCard
        icon={ListChecks}
        label="Line Items"
        value={lineItems?.length || 0}
      />
      <KeyInfoCard
        icon={DollarSign}
        label="Total Amount"
        value={`$${quote.total_amount.toFixed(2)}`}
      />
    </div>
  );

  // Tab configurations
  const tabs: TabConfig[] = [
    {
      value: "line-items",
      label: "Line Items",
      icon: <ListChecks className="h-4 w-4" />,
      content: quote && (
        <Card>
          <CardHeader>
            <CardTitle>Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {quote.description && (
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-muted-foreground mt-1">{quote.description}</p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium mb-3 block">Line Items & Takeoffs</Label>
              <div className="space-y-2">
                {lineItems?.filter((item: any) => !item.parent_line_item_id).map((item: any) => {
                  const subItems = lineItems?.filter((sub: any) => sub.parent_line_item_id === item.id) || [];
                  const hasSubItems = subItems.length > 0;
                  
                  return (
                    <div key={item.id} className="border rounded-lg overflow-hidden">
                      <div className="flex items-start justify-between p-3 bg-muted/20">
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          <div className="text-sm text-muted-foreground mt-1">
                            Qty: {item.quantity}
                            {!hasSubItems && (
                              <>
                                {" • "}Cost: ${item.cost_price?.toFixed(2) || "0.00"}
                                {" • "}Margin: {item.margin_percentage?.toFixed(2) || "0"}%
                                {" • "}Sell: ${item.sell_price?.toFixed(2) || "0.00"}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right font-medium">
                          ${item.line_total.toFixed(2)}
                        </div>
                      </div>
                      
                      {hasSubItems && (
                        <div className="border-t">
                          {subItems.map((subItem: any) => (
                            <div key={subItem.id} className="flex items-start justify-between p-3 pl-8 border-b last:border-b-0 bg-background/50">
                              <div className="flex-1">
                                <p className="text-sm">{subItem.description}</p>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Qty: {subItem.quantity}
                                  {" • "}Cost: ${subItem.cost_price?.toFixed(2) || "0.00"}
                                  {" • "}Margin: {subItem.margin_percentage?.toFixed(2) || "0"}%
                                  {" • "}Sell: ${subItem.sell_price?.toFixed(2) || "0.00"}
                                </div>
                              </div>
                              <div className="text-right text-sm font-medium">
                                ${subItem.line_total.toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">${quote.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({quote.tax_rate}%):</span>
                <span className="font-medium">${quote.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>${quote.total_amount.toFixed(2)}</span>
              </div>
            </div>

            {quote.notes && (
              <div>
                <Label className="text-sm font-medium">Notes</Label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.notes}
                </p>
              </div>
            )}

            {quote.terms_conditions && (
              <div>
                <Label className="text-sm font-medium">Terms & Conditions</Label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.terms_conditions}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "customer",
      label: "Customer",
      icon: <User className="h-4 w-4" />,
      content: quote && (
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Name</Label>
              <p className="text-sm text-muted-foreground">{quote.customer?.name}</p>
            </div>
            {quote.customer?.email && (
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <p className="text-sm text-muted-foreground">{quote.customer.email}</p>
              </div>
            )}
            {quote.customer?.phone && (
              <div>
                <Label className="text-sm font-medium">Phone</Label>
                <p className="text-sm text-muted-foreground">{quote.customer.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "crm-pipeline",
      label: "CRM Pipeline",
      icon: <TrendingUp className="h-4 w-4" />,
      content: quote && (
        <Card>
          <CardHeader>
            <CardTitle>CRM Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Pipeline</Label>
              <Select
                value={quote.pipeline_id || ''}
                onValueChange={(value) => updatePipelineStage('pipeline_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline: any) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Stage</Label>
              <Select
                value={quote.stage_id || ''}
                onValueChange={(value) => updatePipelineStage('stage_id', value)}
                disabled={!quote.pipeline_id || stages.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage: any) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      value: "timeline",
      label: "Timeline",
      icon: <Calendar className="h-4 w-4" />,
      content: quote && (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Created</Label>
              <p className="text-sm text-muted-foreground">
                {format(new Date(quote.created_at), "MMM d, yyyy")}
              </p>
            </div>
            {quote.valid_until && (
              <div>
                <Label className="text-sm font-medium">Valid Until</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(quote.valid_until), "MMM d, yyyy")}
                </div>
              </div>
            )}
            {quote.sent_at && (
              <div>
                <Label className="text-sm font-medium">Sent</Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(quote.sent_at), "MMM d, yyyy")}
                </p>
              </div>
            )}
            {quote.approved_at && (
              <div>
                <Label className="text-sm font-medium">Approved</Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(quote.approved_at), "MMM d, yyyy")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "internal",
      label: "Internal Only",
      icon: <Lock className="h-4 w-4" />,
      content: quote && (quote.internal_notes || (attachments && attachments.length > 0)) && (
        <Card className="border-orange-200 dark:border-orange-900/50">
          <CardHeader className="bg-orange-50 dark:bg-orange-950/20">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Internal Only
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {quote.internal_notes && (
              <div>
                <Label className="text-sm font-medium">Internal Notes</Label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.internal_notes}
                </p>
              </div>
            )}

            {attachments && attachments.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Attachments</Label>
                <div className="space-y-2">
                  {attachments.map((attachment: any) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadAttachment(attachment.file_url, attachment.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "tasks",
      label: "Tasks",
      icon: <ListChecks className="h-4 w-4" />,
      content: <LinkedTasksList linkedModule="quote" linkedRecordId={id!} />,
    },
    {
      value: "history",
      label: "History",
      icon: <History className="h-4 w-4" />,
      content: <AuditTimeline tableName="quotes" recordId={id!} />,
    },
  ];

  return (
    <>
      <DocumentDetailLayout
        title={quote?.title || ""}
        subtitle={`${quote?.quote_number} • ${quote?.customer?.name}`}
        backPath="/quotes"
        statusBadges={statusBadges}
        fileMenuActions={fileMenuActions}
        keyInfoSection={keyInfoSection}
        tabs={tabs}
        defaultTab="line-items"
        isLoading={isLoading}
        notFoundMessage={!quote ? "Quote not found" : undefined}
      />

      {quote && (
        <>
          <QuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} quoteId={id} />

          <QuotePDFDialog 
            open={pdfDialogOpen} 
            onOpenChange={setPdfDialogOpen} 
            quoteId={id!}
            customerEmail={quote.customer?.email}
          />

          <ConvertQuoteDialog
            open={convertDialogOpen}
            onOpenChange={setConvertDialogOpen}
            quote={quote}
            lineItems={lineItems || []}
          />

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this quote? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
