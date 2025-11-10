import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { 
  DollarSign, 
  Calendar, 
  User, 
  FileText, 
  ExternalLink,
  Building,
  Mail,
  Phone
} from "lucide-react";

interface QuoteQuickViewDialogProps {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function QuoteQuickViewDialog({
  quoteId,
  open,
  onOpenChange,
}: QuoteQuickViewDialogProps) {
  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote-quick-view", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      
      const { data: quoteData, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (error) throw error;

      // Fetch related data separately
      const [customerRes, leadRes, ownerRes, pipelineRes, stageRes] = await Promise.all([
        quoteData.customer_id 
          ? supabase.from("customers").select("name, email, phone").eq("id", quoteData.customer_id).single()
          : Promise.resolve({ data: null, error: null }),
        quoteData.lead_id
          ? supabase.from("leads").select("name, email, phone").eq("id", quoteData.lead_id).single()
          : Promise.resolve({ data: null, error: null }),
        quoteData.created_by
          ? supabase.from("profiles").select("first_name, last_name").eq("id", quoteData.created_by).single()
          : Promise.resolve({ data: null, error: null }),
        quoteData.pipeline_id
          ? supabase.from("crm_pipelines").select("name").eq("id", quoteData.pipeline_id).single()
          : Promise.resolve({ data: null, error: null }),
        quoteData.stage_id
          ? supabase.from("crm_status_settings").select("display_name, color").eq("id", quoteData.stage_id).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      return {
        ...quoteData,
        customer: customerRes.data,
        lead: leadRes.data,
        quote_owner: ownerRes.data,
        pipeline: pipelineRes.data,
        stage: stageRes.data,
      };
    },
    enabled: !!quoteId && open,
  });

  const { data: lineItems } = useQuery({
    queryKey: ["quote-line-items-quick", quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      
      const { data, error } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("item_order");

      if (error) throw error;
      return data;
    },
    enabled: !!quoteId && open,
  });

  const customerOrLead = (quote?.customer || quote?.lead) as { name: string; email?: string; phone?: string } | null;
  const ownerName = quote?.quote_owner 
    ? `${(quote.quote_owner as any).first_name || ''} ${(quote.quote_owner as any).last_name || ''}`.trim()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{quote?.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{quote?.quote_number}</Badge>
                {quote?.stage && (
                  <Badge style={{ backgroundColor: quote.stage.color, color: 'white' }}>
                    {quote.stage.display_name}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/quotes/${quoteId}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Details
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Financial Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold">${quote?.subtotal?.toLocaleString() || '0.00'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tax ({quote?.tax_rate}%):</span>
                  <span className="font-semibold">${quote?.tax_amount?.toLocaleString() || '0.00'}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-lg">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="font-bold text-primary flex items-center gap-1">
                    <DollarSign className="h-5 w-5" />
                    {quote?.total_amount?.toLocaleString() || '0.00'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Customer/Lead Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {quote?.customer ? 'Customer' : 'Lead'} Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{customerOrLead?.name}</span>
                </div>
                {customerOrLead?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{customerOrLead.email}</span>
                  </div>
                )}
                {customerOrLead?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{customerOrLead.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quote Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quote Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ownerName && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Owner:</span> {ownerName}
                    </span>
                  </div>
                )}
                {quote?.pipeline && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Pipeline:</span> {quote.pipeline.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Created:</span>{' '}
                    {quote?.created_at && format(new Date(quote.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                {quote?.valid_until && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <span className="text-muted-foreground">Valid Until:</span>{' '}
                      {format(new Date(quote.valid_until), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {quote?.description && (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground mb-1">Description:</p>
                    <p className="text-sm">{quote.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line Items */}
            {lineItems && lineItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    Line Items ({lineItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lineItems.slice(0, 5).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity} × ${item.unit_price?.toLocaleString()}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">
                          ${item.line_total?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {lineItems.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        + {lineItems.length - 5} more items
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
