import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, FileText, CheckSquare, Paperclip, CornerDownRight, Forward, Plus, ChevronDown, ChevronUp, Link, Unlink, AtSign, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { TicketActionsMenu } from "./TicketActionsMenu";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmailComposer, EmailComposerRef } from "./EmailComposer";
import { ChecklistRenderer } from "./ChecklistRenderer";
import { InlineNoteEditor } from "./InlineNoteEditor";
import { InlineTaskEditor } from "./InlineTaskEditor";
import { InlineCheckboxEditor } from "./InlineCheckboxEditor";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";

interface TicketTimelineProps {
  ticketId: string;
  ticket: any;
}

export function TicketTimeline({ ticketId, ticket }: TicketTimelineProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const composerRef = useRef<EmailComposerRef>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [showCheckboxEditor, setShowCheckboxEditor] = useState(false);
  const navigate = useNavigate();

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


  const renderMentions = (text: string) => {
    if (!text) return null;
    // Convert @[Name](userId) to highlighted mentions
    const parts = text.split(/(@\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
      const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <span key={index} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-medium">
            <AtSign className="h-3 w-3" />
            {match[1]}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const MentionBadge = ({ userId }: { userId: string }) => {
    const { data: user } = useQuery({
      queryKey: ["user-profile", userId],
      queryFn: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", userId)
          .single();
        return data;
      },
    });

    if (!user) return null;

    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <AtSign className="h-3 w-3" />
        {fullName || user.email}
      </Badge>
    );
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

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("helpdesk_messages")
        .insert({
          ticket_id: ticketId,
          message_type: "internal_note",
          body: content,
          tenant_id: (await supabase.auth.getUser()).data.user?.user_metadata?.tenant_id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Note added successfully" });
      setShowNoteEditor(false);
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to add note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get tenant_id from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          ...taskData,
          tenant_id: profile.tenant_id,
          created_by: user.id,
          linked_module: "helpdesk",
          linked_record_id: ticketId,
          status: "pending",
        })
        .select()
        .single();
      
      if (taskError) throw taskError;

      // Also add a message to the timeline
      const { error: messageError } = await supabase
        .from("helpdesk_messages")
        .insert({
          ticket_id: ticketId,
          message_type: "task",
          body: `Task created: ${taskData.title}`,
          tenant_id: profile.tenant_id,
        });
      
      if (messageError) throw messageError;
    },
    onSuccess: () => {
      toast({ title: "Task created successfully" });
      setShowTaskEditor(false);
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCheckboxMutation = useMutation({
    mutationFn: async (checkboxData: { title: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get tenant_id and ticket owner from profiles and ticket
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Get ticket owner
      const { data: ticketData } = await supabase
        .from("helpdesk_tickets")
        .select("assigned_to")
        .eq("id", ticketId)
        .single();

      const today = new Date().toISOString().split('T')[0];

      // Create the task as a checkbox
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: checkboxData.title,
          description: "",
          priority: "medium",
          assigned_to: ticketData?.assigned_to || user.id,
          due_date: today,
          tenant_id: profile.tenant_id,
          created_by: user.id,
          linked_module: "helpdesk",
          linked_record_id: ticketId,
          status: "pending",
        })
        .select()
        .single();
      
      if (taskError) throw taskError;

      // Also add a message to the timeline
      const { error: messageError } = await supabase
        .from("helpdesk_messages")
        .insert({
          ticket_id: ticketId,
          message_type: "checklist",
          body: `☐ ${checkboxData.title}`,
          tenant_id: profile.tenant_id,
        });
      
      if (messageError) throw messageError;
    },
    onSuccess: () => {
      toast({ title: "Checkbox created successfully" });
      setShowCheckboxEditor(false);
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create checkbox",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "note": return <MessageSquare className="h-4 w-4" />;
      case "internal_note": return <MessageSquare className="h-4 w-4" />;
      case "task": return <CheckSquare className="h-4 w-4" />;
      case "checklist": return <CheckSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case "email": return "text-blue-600 dark:text-blue-400";
      case "note": return "text-purple-600 dark:text-purple-400";
      case "internal_note": return "text-purple-600 dark:text-purple-400";
      case "task": return "text-orange-600 dark:text-orange-400";
      case "checklist": return "text-green-600 dark:text-green-400";
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - Compact */}
      <div className="px-3 py-2 border-b bg-background shrink-0">
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
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full p-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">Loading messages...</div>
          ) : (
            <div className="space-y-3 pb-2">
              {timelineItems && timelineItems.length > 0 && timelineItems.map((item, index) => {
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
                                  __html: DOMPurify.sanitize(
                                    isEmail && !isExpanded ? stripQuotedReply(message.body_html) : message.body_html,
                                    {
                                      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img'],
                                      ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'],
                                      ALLOW_DATA_ATTR: false
                                    }
                                  )
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
                          ) : message.message_type === "checklist" && message.metadata?.task_id ? (
                            <ChecklistRenderer taskId={message.metadata.task_id} ticketNumber={ticket?.ticket_number || ""} />
                          ) : message.message_type === "task" && message.metadata?.task_id ? (
                            <div className="space-y-2">
                              <div className="whitespace-pre-wrap">
                                {renderMentions(message.body_text || message.body || "")}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/tasks')}
                                className="h-6 text-xs gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View Task
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="whitespace-pre-wrap">
                                {renderMentions(message.body_text || message.body || "")}
                              </div>
                              {message.metadata?.mentions && message.metadata.mentions.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap pt-1 border-t border-border/50">
                                  {message.metadata.mentions.map((userId: string) => (
                                    <MentionBadge key={userId} userId={userId} />
                                  ))}
                                </div>
                              )}
                            </div>
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
              
              {/* Add Item Buttons - Inline in timeline */}
              <div className="relative flex flex-col gap-2 py-4">
                {/* Center line */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-px h-full bg-border/30" />
                </div>
                
                {/* Action Buttons */}
                {!showNoteEditor && !showTaskEditor && !showCheckboxEditor && (
                  <div className="relative flex items-center gap-1 bg-background px-2 justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNoteEditor(true)}
                      className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs">Add Note</span>
                    </Button>
                    <div className="h-4 w-px bg-border/50" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTaskEditor(true)}
                      className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <CheckSquare className="h-4 w-4" />
                      <span className="text-xs">Add Task</span>
                    </Button>
                    <div className="h-4 w-px bg-border/50" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCheckboxEditor(true)}
                      className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <CheckSquare className="h-4 w-4" />
                      <span className="text-xs">Add Checkbox</span>
                    </Button>
                  </div>
                )}

                {/* Inline Editors */}
                {showNoteEditor && (
                  <div className="relative z-10 px-2">
                    <InlineNoteEditor
                      onSave={async (content) => {
                        await createNoteMutation.mutateAsync(content);
                      }}
                      onCancel={() => setShowNoteEditor(false)}
                      isSaving={createNoteMutation.isPending}
                    />
                  </div>
                )}

                {showTaskEditor && (
                  <div className="relative z-10 px-2">
                    <InlineTaskEditor
                      defaultTitle={ticket?.subject}
                      onSave={async (taskData) => {
                        await createTaskMutation.mutateAsync(taskData);
                      }}
                      onCancel={() => setShowTaskEditor(false)}
                      isSaving={createTaskMutation.isPending}
                    />
                  </div>
                )}

                {showCheckboxEditor && (
                  <div className="relative z-10 px-2">
                    <InlineCheckboxEditor
                      onSave={async (checkboxData) => {
                        await createCheckboxMutation.mutateAsync(checkboxData);
                      }}
                      onCancel={() => setShowCheckboxEditor(false)}
                      isSaving={createCheckboxMutation.isPending}
                    />
                  </div>
                )}
              </div>
              
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Email Composer */}
      <EmailComposer
        ref={composerRef}
        onSend={(emailData) => sendReplyMutation.mutate(emailData)}
        defaultTo={ticket?.sender_email || ticket?.external_email || ""}
        defaultSubject={ticket?.subject ? `RE: ${ticket.subject}` : ""}
        isSending={sendReplyMutation.isPending}
        ticketId={ticketId}
      />
    </div>
  );
}
