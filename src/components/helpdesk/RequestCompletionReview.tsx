import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Send, Eye, Image as ImageIcon, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomerNotificationDialog } from "./CustomerNotificationDialog";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface RequestCompletionReviewProps {
  ticketId: string;
  ticket: any;
}

export function RequestCompletionReview({ ticketId, ticket }: RequestCompletionReviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);

  const { data: markups, isLoading } = useQuery({
    queryKey: ["ticket-markups-review", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_markups")
        .select("*")
        .eq("ticket_id", ticketId);

      if (error) throw error;
      return data;
    },
  });

  const markAsReviewedMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("helpdesk_tickets")
        .update({
          completion_reviewed_at: new Date().toISOString(),
          completion_reviewed_by: user.id,
          status: "completed",
        })
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Request marked as reviewed" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark as reviewed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const totalMarkups = markups?.length || 0;
  const completedMarkups = markups?.filter((m: any) => m.status === "completed").length || 0;
  const allCompleted = totalMarkups > 0 && totalMarkups === completedMarkups;
  const isReviewed = !!ticket.completion_reviewed_at;
  const isCustomerNotified = !!ticket.customer_notified_at;

  if (totalMarkups === 0) {
    return null;
  }

  return (
    <>
      <Card className={cn(
        "border-2",
        allCompleted ? "border-success/30 bg-success/5" : "border-border"
      )}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Completion Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Overview */}
          <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
            <div>
              <p className="text-sm font-medium">Work Progress</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedMarkups} of {totalMarkups} items completed
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {totalMarkups > 0 ? Math.round((completedMarkups / totalMarkups) * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            {allCompleted && (
              <Badge className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                All Work Completed
              </Badge>
            )}
            {isReviewed && (
              <Badge className="bg-info/10 text-info border-info/20">
                Reviewed
              </Badge>
            )}
            {isCustomerNotified && (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Customer Notified
              </Badge>
            )}
          </div>

          {/* Markups Summary */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading markups...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Responses Summary</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {markups?.map((markup: any, index: number) => (
                  <div key={markup.id} className="p-2 bg-muted/30 rounded text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {markup.markup_data?.type === "pin" ? "📍 Pin" : "🔲 Zone"} #{index + 1}
                      </span>
                      <Badge 
                        variant={markup.status === "completed" ? "default" : "outline"}
                        className="text-[10px] h-4 px-1.5"
                      >
                        {markup.status}
                      </Badge>
                    </div>
                    {markup.response_notes && (
                      <div className="flex items-start gap-1.5 text-muted-foreground">
                        <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-2">{markup.response_notes}</p>
                      </div>
                    )}
                    {markup.response_photos && Array.isArray(markup.response_photos) && markup.response_photos.length > 0 && (
                      <div className="flex items-center gap-1 text-success">
                        <ImageIcon className="h-3 w-3" />
                        <span>{markup.response_photos.length} photo(s) attached</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            {allCompleted && !isReviewed && (
              <Button
                onClick={() => markAsReviewedMutation.mutate()}
                disabled={markAsReviewedMutation.isPending}
                variant="outline"
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Reviewed
              </Button>
            )}
            
            {allCompleted && (
              <Button
                onClick={() => setNotificationDialogOpen(true)}
                disabled={!isReviewed && !isCustomerNotified}
                size="sm"
                className="bg-primary"
              >
                <Send className="h-4 w-4 mr-2" />
                {isCustomerNotified ? "Resend Notification" : "Notify Customer"}
              </Button>
            )}

            {!allCompleted && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Complete all work items to notify the customer
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CustomerNotificationDialog
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
        ticketId={ticketId}
        ticket={ticket}
        markups={markups || []}
      />
    </>
  );
}
