import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
} from "lucide-react";
import QuoteDialog from "@/components/quotes/QuoteDialog";
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
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertType, setConvertType] = useState<"service_order" | "project">("service_order");

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

  const handleConvert = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      if (convertType === "service_order") {
        const { data: newOrder, error } = await supabase
          .from("service_orders")
          .insert([
            {
              tenant_id: profile.tenant_id,
              customer_id: quote.customer_id,
              title: quote.title,
              description: quote.description,
              order_number: `SO-${Date.now()}`,
              created_by: user.id,
              status: "draft",
            },
          ])
          .select()
          .single();

        if (error) throw error;

        await supabase
          .from("quotes")
          .update({
            status: "converted",
            converted_to_service_order_id: newOrder.id,
          })
          .eq("id", id);

        toast({ title: "Quote converted to service order" });
        navigate("/service-orders");
      } else {
        const { data: newProject, error } = await supabase
          .from("projects")
          .insert([
            {
              tenant_id: profile.tenant_id,
              customer_id: quote.customer_id,
              name: quote.title,
              description: quote.description,
              budget: quote.total_amount,
              created_by: user.id,
              status: "planning",
            },
          ])
          .select()
          .single();

        if (error) throw error;

        await supabase
          .from("quotes")
          .update({
            status: "converted",
            converted_to_project_id: newProject.id,
          })
          .eq("id", id);

        toast({ title: "Quote converted to project" });
        navigate("/projects");
      }

      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error: any) {
      toast({
        title: "Error converting quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading quote...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!quote) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Quote not found</p>
          <Button onClick={() => navigate("/quotes")} className="mt-4">
            Back to Quotes
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    sent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    expired: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    converted: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{quote.title}</h1>
              <Badge variant="outline" className={statusColors[quote.status]}>
                {quote.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {quote.quote_number} • {quote.customer?.name}
            </p>
          </div>
          <div className="flex gap-2">
            {quote.status === "draft" && (
              <Button variant="outline" onClick={() => updateStatus("sent")}>
                <Send className="mr-2 h-4 w-4" />
                Mark as Sent
              </Button>
            )}
            {quote.status === "sent" && (
              <>
                <Button variant="outline" onClick={() => updateStatus("approved")}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button variant="outline" onClick={() => updateStatus("rejected")}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {(quote.status === "approved" || quote.status === "sent") && !quote.converted_to_service_order_id && !quote.converted_to_project_id && (
              <Button
                onClick={() => {
                  setConvertType("service_order");
                  setConvertDialogOpen(true);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                Convert to Order
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
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
                {quote.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="font-medium">-${quote.discount_amount.toFixed(2)}</span>
                  </div>
                )}
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

          <div className="space-y-6">
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
          </div>
        </div>
      </div>

      <QuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} quoteId={id} />

      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to convert this quote to a service order or project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 my-4">
            <Button
              variant={convertType === "service_order" ? "default" : "outline"}
              onClick={() => setConvertType("service_order")}
              className="flex-1"
            >
              Service Order
            </Button>
            <Button
              variant={convertType === "project" ? "default" : "outline"}
              onClick={() => setConvertType("project")}
              className="flex-1"
            >
              Project
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert}>Convert</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
