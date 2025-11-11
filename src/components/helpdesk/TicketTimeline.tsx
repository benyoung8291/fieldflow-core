import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, FileText, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmailComposer } from "./EmailComposer";

interface TicketTimelineProps {
  ticketId: string;
  ticket: any;
}

export function TicketTimeline({ ticketId, ticket }: TicketTimelineProps) {
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
    mutationFn: async (emailData: any) => {
      const { data, error } = await supabase.functions.invoke(
        "helpdesk-send-email",
        {
          body: {
            ticket_id: ticketId,
            to_emails: emailData.to,
            cc_emails: emailData.cc,
            bcc_emails: emailData.bcc,
            subject: emailData.subject,
            body_plain: emailData.body,
            body_html: emailData.bodyHtml,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
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
      {/* Header - Compact */}
      <div className="px-3 py-2 border-b bg-background">
        <h2 className="text-sm font-semibold mb-0.5 line-clamp-1">{ticket?.subject || "Loading..."}</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{ticket?.ticket_number}</span>
          {ticket?.customer && (
            <>
              <span>•</span>
              <span>{ticket.customer.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Timeline - Compact */}
      <ScrollArea className="flex-1 p-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-4">Loading messages...</div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={message.id} className="relative">
                {index !== messages.length - 1 && (
                  <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
                )}
                
                <div className="flex gap-2">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0 border border-background",
                    message.direction === "inbound" ? "bg-blue-500/10" : 
                    message.direction === "outbound" ? "bg-green-500/10" : "bg-purple-500/10"
                  )}>
                    <div className={getMessageTypeColor(message.message_type)}>
                      {getMessageIcon(message.message_type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="bg-card border rounded-md p-2">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-xs">
                              {message.sender_name || message.from_name || message.created_user?.first_name + " " + message.created_user?.last_name || "Unknown"}
                            </span>
                            {(message.sender_email || message.from_email) && (
                              <span className="text-xs text-muted-foreground">&lt;{message.sender_email || message.from_email}&gt;</span>
                            )}
                            <Badge variant="outline" className="text-xs h-4 px-1">
                              {message.message_type.replace("_", " ")}
                            </Badge>
                          </div>
                          {message.to_email && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              To: {message.to_email}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(message.sent_at || message.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {message.subject && message.message_type === "email" && (
                        <p className="font-medium text-xs mb-1">{message.subject}</p>
                      )}

                      <div className="text-xs whitespace-pre-wrap max-w-full overflow-hidden">
                        {message.body_html ? (
                          <div 
                            className="prose prose-xs max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: message.body_html }} 
                          />
                        ) : (
                          message.body_text || message.body
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-sm py-4">No messages yet</div>
        )}
      </ScrollArea>

      {/* Email Composer */}
      <EmailComposer
        onSend={(emailData) => sendReplyMutation.mutate(emailData)}
        defaultTo={ticket?.sender_email || ticket?.external_email || ""}
        isSending={sendReplyMutation.isPending}
      />
    </div>
  );
}
