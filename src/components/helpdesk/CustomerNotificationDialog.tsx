import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface CustomerNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticket: any;
  markups: any[];
}

export function CustomerNotificationDialog({
  open,
  onOpenChange,
  ticketId,
  ticket,
  markups,
}: CustomerNotificationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(
    `Dear Customer,\n\nWe're pleased to inform you that we've completed the work on your request "${ticket.subject}".\n\nAll ${markups.length} item(s) have been addressed and our team has provided detailed responses with photos.\n\nYou can view the full details by logging into your customer portal.\n\nBest regards,\nThe Team`
  );

  const notifyCustomerMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Call edge function to send notification
      const { data, error } = await supabase.functions.invoke(
        "notify-customer-request-complete",
        {
          body: {
            ticketId,
            message,
          },
        }
      );

      if (error) throw error;

      // Update ticket with notification timestamp
      const { error: updateError } = await supabase
        .from("helpdesk_tickets")
        .update({
          customer_notified_at: new Date().toISOString(),
          customer_notified_by: user.id,
          status: "closed",
        })
        .eq("id", ticketId);

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: () => {
      toast({ title: "Customer notified successfully" });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticketId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to notify customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completedCount = markups.filter(m => m.status === "completed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Notify Customer</DialogTitle>
          <DialogDescription>
            Send a completion notification to the customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Request Summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{ticket.subject}</p>
              <Badge variant="outline" className="text-xs">
                #{ticket.ticket_number}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {completedCount} of {markups.length} items completed
            </div>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="notification-message">Notification Message</Label>
            <Textarea
              id="notification-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder="Enter the message to send to the customer..."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This message will be sent to the customer via email and in-app notification
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={notifyCustomerMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => notifyCustomerMutation.mutate()}
            disabled={notifyCustomerMutation.isPending || !message.trim()}
          >
            {notifyCustomerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
