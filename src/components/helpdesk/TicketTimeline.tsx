import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, MessageSquare, Mail, FileText, CheckSquare } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TicketTimelineProps {
  ticketId: string;
  ticket: any;
}

export function TicketTimeline({ ticketId, ticket }: TicketTimelineProps) {
  const [replyText, setReplyText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["helpdesk-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_messages" as any)
        .select(`
          *,
          created_user:profiles!helpdesk_messages_created_by_fkey(first_name, last_name, avatar_url)
        `)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.functions.invoke(
        "helpdesk-send-email",
        {
          body: {
            ticket_id: ticketId,
            body_plain: body,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      setReplyText("");
      toast({ title: "Reply sent successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send reply",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "internal_note": return <MessageSquare className="h-4 w-4" />;
      case "internal_chat": return <MessageSquare className="h-4 w-4" />;
      case "task_card": return <CheckSquare className="h-4 w-4" />;
      case "document_card": return <FileText className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case "email": return "text-blue-600 dark:text-blue-400";
      case "internal_note": return "text-purple-600 dark:text-purple-400";
      case "internal_chat": return "text-green-600 dark:text-green-400";
      case "task_card": return "text-orange-600 dark:text-orange-400";
      case "document_card": return "text-pink-600 dark:text-pink-400";
      default: return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-background">
        <h2 className="text-lg font-semibold mb-1">{ticket?.subject || "Loading..."}</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{ticket?.ticket_number}</span>
          {ticket?.customer && (
            <>
              <span>•</span>
              <span>{ticket.customer.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center text-muted-foreground">Loading messages...</div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-6">
            {messages.map((message, index) => (
              <div key={message.id} className="relative">
                {index !== messages.length - 1 && (
                  <div className="absolute left-5 top-12 bottom-0 w-px bg-border" />
                )}
                
                <div className="flex gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0 border-2 border-background",
                    message.direction === "inbound" ? "bg-blue-500/10" : 
                    message.direction === "outbound" ? "bg-green-500/10" : "bg-purple-500/10"
                  )}>
                    <div className={getMessageTypeColor(message.message_type)}>
                      {getMessageIcon(message.message_type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="bg-card border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {message.from_name || message.created_user?.first_name + " " + message.created_user?.last_name || "Unknown"}
                            </span>
                            {message.from_email && (
                              <span className="text-xs text-muted-foreground">{message.from_email}</span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {message.message_type.replace("_", " ")}
                            </Badge>
                          </div>
                          {message.to_emails && message.to_emails.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              To: {message.to_emails.join(", ")}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {message.subject && message.message_type === "email" && (
                        <p className="font-medium text-sm mb-2">{message.subject}</p>
                      )}

                      <div className="text-sm whitespace-pre-wrap">
                        {message.body_html ? (
                          <div dangerouslySetInnerHTML={{ __html: message.body_html }} />
                        ) : (
                          message.body_plain
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground">No messages yet</div>
        )}
      </ScrollArea>

      {/* Compose Area */}
      <div className="p-4 border-t bg-background space-y-3">
        <Textarea
          placeholder="Type your reply..."
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          className="min-h-[100px] resize-none"
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm">
            <Paperclip className="h-4 w-4 mr-2" />
            Attach
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // TODO: Add internal note functionality
              }}
            >
              Internal Note
            </Button>
            <Button 
              size="sm"
              onClick={() => sendReplyMutation.mutate(replyText)}
              disabled={!replyText.trim() || sendReplyMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
