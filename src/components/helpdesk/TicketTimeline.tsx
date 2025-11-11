import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, FileText, CheckSquare, Paperclip, CornerDownRight, Forward, Plus, ChevronDown, ChevronUp, Link, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TicketActionsMenu } from "./TicketActionsMenu";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmailComposer, EmailComposerRef } from "./EmailComposer";
import { AddTimelineItemDialog } from "./AddTimelineItemDialog";
import { useRef, useState, useEffect } from "react";

interface TicketTimelineProps {
  ticketId: string;
  ticket: any;
}

export function TicketTimeline({ ticketId, ticket }: TicketTimelineProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const composerRef = useRef<EmailComposerRef>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

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

  const { data: auditLogs } = useQuery({
    queryKey: ["helpdesk-audit-logs", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs" as any)
        .select("*, user:profiles(first_name, last_name)")
        .eq("entity_type", "helpdesk_linked_documents")
        .or(`details->>ticket_id.eq.${ticketId}`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Audit log fetch error:", error);
        return [];
      }
      return data as any[];
    },
  });

  // Combine and sort messages and audit logs
  const timelineItems = [...(messages || []), ...(auditLogs || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Auto-scroll to bottom on load
  useEffect(() => {
    if (scrollRef.current && timelineItems.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [ticketId, timelineItems.length]);

  const toggleEmailExpanded = (messageId: string) => {
    setExpandedEmails(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const stripQuotedReply = (html: string) => {
    // Simple heuristic: remove everything after common reply indicators
    const indicators = [
      /<div[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>/i,
      /<div[^>]*id="[^"]*divRplyFwdMsg[^"]*"[^>]*>/i,
      /<hr[^>]*>/i,
      /On.*wrote:/i,
      /From:.*Sent:/i,
    ];
    
    let result = html;
    for (const indicator of indicators) {
      const match = result.match(indicator);
      if (match && match.index) {
        result = result.substring(0, match.index);
        break;
      }
    }
    return result;
  };

  const sendReplyMutation = useMutation({
    mutationFn: async (emailData: any) => {
      // Get the email account ID from the ticket
      if (!ticket?.email_account_id) {
        throw new Error("No email account associated with this ticket");
      }

      const toEmails = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
      const ccEmails = Array.isArray(emailData.cc) ? emailData.cc : emailData.cc ? [emailData.cc] : [];
      const bccEmails = Array.isArray(emailData.bcc) ? emailData.bcc : emailData.bcc ? [emailData.bcc] : [];
      
      const { data, error } = await supabase.functions.invoke(
        "microsoft-send-email",
        {
          body: {
            emailAccountId: ticket.email_account_id,
            ticketId: ticketId,
            to: toEmails,
            cc: ccEmails,
            bcc: bccEmails,
            subject: emailData.subject,
            body: emailData.body,
            conversationId: ticket.microsoft_conversation_id,
            replyTo: ticket.microsoft_message_id,
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
      composerRef.current?.reset();
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

  const isReply = (message: any) => {
    return message.subject?.startsWith("RE:") || message.subject?.startsWith("Re:");
  };

  const isForward = (message: any) => {
    return message.subject?.startsWith("FW:") || message.subject?.startsWith("Fw:");
  };

  const getThreadingIcon = (message: any) => {
    if (isForward(message)) return <Forward className="h-3 w-3" />;
    if (isReply(message)) return <CornerDownRight className="h-3 w-3" />;
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Compact */}
      <div className="px-3 py-2 border-b bg-background">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold mb-0.5 line-clamp-1">{ticket?.subject || "Loading..."}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-mono">{ticket?.ticket_number}</span>
              {ticket?.customer && (
                <>
                  <span>•</span>
                  <span>{ticket.customer.name}</span>
                </>
              )}
              {ticket?.assigned_user && (
                <>
                  <span>•</span>
                  <span>Assigned to: {ticket.assigned_user.first_name} {ticket.assigned_user.last_name}</span>
                </>
              )}
            </div>
          </div>
          {ticket && <TicketActionsMenu ticket={ticket} />}
        </div>
      </div>

      {/* Timeline - Compact */}
      <div className="relative flex-1 overflow-hidden">
        <ScrollArea className="h-full p-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">Loading messages...</div>
          ) : timelineItems && timelineItems.length > 0 ? (
            <div className="space-y-3 pb-2">
              {timelineItems.map((item, index) => {
                // Check if this is an audit log
                const isAuditLog = !item.message_type;
                
                if (isAuditLog) {
                  // Render audit log entry
                  const actionText = item.action === "create" 
                    ? "linked document" 
                    : item.action === "delete" 
                    ? "unlinked document" 
                    : item.action;
                  const docType = item.details?.document_type || "document";
                  
                  return (
                    <div key={item.id} className="relative flex items-center justify-center py-2">
                      {/* Center line */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-px h-full bg-border/30" />
                      </div>
                      
                      {/* Audit text */}
                      <div className="relative bg-background px-3 py-1 rounded-full border border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.action === "create" ? (
                            <Link className="h-3 w-3" />
                          ) : (
                            <Unlink className="h-3 w-3" />
                          )}
                          <span>
                            {item.user?.first_name} {item.user?.last_name} {actionText} ({docType.replace("_", " ")})
                          </span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Regular message rendering
                const message = item;
                const messageIsReply = isReply(message);
                const messageIsForward = isForward(message);
                const shouldIndent = messageIsReply || messageIsForward;
                const isExpanded = expandedEmails.has(message.id);
                const isEmail = message.message_type === "email";
                
                return (
                  <div key={message.id} className="relative">
                    {/* Threading line */}
                    {index !== timelineItems.length - 1 && (
                      <div className={cn(
                        "absolute top-8 bottom-0 w-px",
                        shouldIndent ? "left-8" : "left-4",
                        message.direction === "inbound" 
                          ? "bg-blue-500/30" 
                          : message.direction === "outbound" 
                          ? "bg-green-500/30" 
                          : "bg-purple-500/30"
                      )} />
                    )}
                    
                    {/* Branch indicator for replies/forwards */}
                    {shouldIndent && (
                      <div className={cn(
                        "absolute left-4 top-4 w-4 h-px",
                        message.direction === "inbound" 
                          ? "bg-blue-500/30" 
                          : message.direction === "outbound" 
                          ? "bg-green-500/30" 
                          : "bg-border"
                      )} />
                    )}
                    
                    <div className={cn("flex gap-2", shouldIndent && "ml-4")}>
                      <div className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2 bg-background relative z-10",
                        message.direction === "inbound" 
                          ? "border-blue-500/50" 
                          : message.direction === "outbound" 
                          ? "border-green-500/50" 
                          : "border-purple-500/50"
                      )}>
                        <div className={getMessageTypeColor(message.message_type)}>
                          {getMessageIcon(message.message_type)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "bg-card border rounded-md p-2",
                          message.direction === "inbound" && "border-l-2 border-l-blue-500/30",
                          message.direction === "outbound" && "border-l-2 border-l-green-500/30"
                        )}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {getThreadingIcon(message) && (
                                  <span className={cn(
                                    "flex items-center",
                                    messageIsForward ? "text-orange-500" : "text-blue-500"
                                  )}>
                                    {getThreadingIcon(message)}
                                  </span>
                                )}
                                <span className="font-medium text-xs">
                                  {message.sender_name || message.from_name || message.created_user?.first_name + " " + message.created_user?.last_name || "Unknown"}
                                </span>
                                {(message.sender_email || message.from_email) && (
                                  <span className="text-xs text-muted-foreground">&lt;{message.sender_email || message.from_email}&gt;</span>
                                )}
                                <Badge variant="outline" className="text-xs h-4 px-1">
                                  {message.message_type.replace("_", " ")}
                                </Badge>
                                {message.direction && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs h-4 px-1",
                                      message.direction === "inbound" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                                      message.direction === "outbound" && "bg-green-500/10 text-green-600 dark:text-green-400"
                                    )}
                                  >
                                    {message.direction === "inbound" ? "↓" : "↑"}
                                  </Badge>
                                )}
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
                            <>
                              <div 
                                className="prose prose-xs max-w-none dark:prose-invert [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
                                dangerouslySetInnerHTML={{ 
                                  __html: isEmail && !isExpanded ? stripQuotedReply(message.body_html) : message.body_html 
                                }} 
                              />
                              {isEmail && message.body_html.length > 500 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleEmailExpanded(message.id)}
                                  className="mt-1 h-6 text-xs"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Show less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show full email
                                    </>
                                  )}
                                </Button>
                              )}
                            </>
                          ) : (
                            message.body_text || message.body
                          )}
                        </div>

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs font-medium mb-1 text-muted-foreground">Attachments:</p>
                            <div className="flex flex-wrap gap-1">
                              {message.attachments.map((attachment: any, idx: number) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    if (attachment.id) {
                                      // Download attachment from Microsoft Graph
                                      const downloadUrl = `https://graph.microsoft.com/v1.0/me/messages/${message.microsoft_message_id}/attachments/${attachment.id}/$value`;
                                      window.open(downloadUrl, '_blank');
                                    }
                                  }}
                                >
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  {attachment.name}
                                  {attachment.size && (
                                    <span className="ml-1 text-muted-foreground">
                                      ({Math.round(attachment.size / 1024)}KB)
                                    </span>
                                  )}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-4">No messages yet</div>
          )}
        </ScrollArea>
        
        {/* Add Item Button */}
        <div className="absolute bottom-4 right-4 z-10">
          <Button
            size="icon"
            className="rounded-full h-10 w-10 shadow-lg"
            onClick={() => setAddItemDialogOpen(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Email Composer */}
      <EmailComposer
        ref={composerRef}
        onSend={(emailData) => sendReplyMutation.mutate(emailData)}
        defaultTo={ticket?.sender_email || ticket?.external_email || ""}
        defaultSubject={ticket?.subject ? `RE: ${ticket.subject}` : ""}
        isSending={sendReplyMutation.isPending}
      />

      <AddTimelineItemDialog
        open={addItemDialogOpen}
        onOpenChange={setAddItemDialogOpen}
        ticketId={ticketId}
      />
    </div>
  );
}
