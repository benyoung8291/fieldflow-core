import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Mail, CheckSquare, Paperclip, CornerDownRight, Forward, Plus, ChevronDown, ChevronUp, Link, Unlink, AtSign, ExternalLink, StickyNote, CheckCircle2, Copy } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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

  // Fetch linked tasks for checkbox matching  
  const getTaskByTitle = async (title: string): Promise<{ id: string; title: string; status: string } | null> => {
    try {
      const result = await (supabase as any)
        .from("tasks")
        .select("id, title, status")
        .eq("linked_module", "helpdesk")
        .eq("linked_id", ticketId)
        .eq("title", title)
        .maybeSingle();
    
      return result.data || null;
    } catch (error) {
      console.error("Error fetching task:", error);
      return null;
    }
  };

  // Combine and sort all timeline items chronologically
  const timelineItems = [...(messages || []), ...(auditLogs || [])].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Get email thread for replies (all previous emails in chronological order)
  const emailThread = (messages || [])
    .filter((m: any) => m.message_type === 'email')
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

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
    mutationFn: async ({ content, mentions }: { content: string; mentions: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      const { data: newMessage, error } = await supabase
        .from("helpdesk_messages")
        .insert({
          ticket_id: ticketId,
          message_type: "internal_note",
          body: content,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Create notifications for mentioned users
      if (mentions.length > 0) {
        const notificationsToCreate = mentions.map(mentionedUserId => ({
          tenant_id: profile.tenant_id,
          user_id: mentionedUserId,
          type: 'mention' as const,
          title: 'You were mentioned in a note',
          message: `${profile.first_name} ${profile.last_name} mentioned you in a help desk note`,
          link: `/helpdesk?ticket=${ticketId}`,
          metadata: {
            ticket_id: ticketId,
            message_id: (newMessage as any)?.id,
            mentioned_by: user.id,
            context: 'helpdesk_note'
          }
        }));

        // @ts-ignore - Types will update after migration
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notificationsToCreate);

        if (notifError) console.error('Failed to create notifications:', notifError);
      }
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
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          assigned_to: taskData.assigned_to,
          due_date: taskData.due_date,
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

      // Create notifications for mentioned users
      if (taskData.mentions && taskData.mentions.length > 0) {
        const notificationsToCreate = taskData.mentions
          .filter((mentionedUserId: string) => mentionedUserId !== user.id && mentionedUserId !== taskData.assigned_to)
          .map((mentionedUserId: string) => ({
            tenant_id: profile.tenant_id,
            user_id: mentionedUserId,
            type: 'mention' as const,
            title: 'You were mentioned in a task',
            message: `${profile.first_name} ${profile.last_name} mentioned you in task: ${taskData.title}`,
            link: `/tasks`,
            metadata: {
              task_id: task.id,
              ticket_id: ticketId,
              mentioned_by: user.id,
              context: 'helpdesk_task'
            }
          }));

        if (notificationsToCreate.length > 0) {
          // @ts-ignore - Types will update after migration
          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notificationsToCreate);

          if (notifError) console.error('Failed to create notifications:', notifError);
        }
      }

      // Create notification for assigned user (if different from creator and not in mentions)
      if (taskData.assigned_to && taskData.assigned_to !== user.id) {
        const assignerName = `${profile.first_name} ${profile.last_name}`.trim();
        // @ts-ignore - Types will update after migration
        const { error: assignNotifError } = await supabase
          .from('notifications')
          .insert({
            tenant_id: profile.tenant_id,
            user_id: taskData.assigned_to,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `${assignerName} assigned you the task: ${taskData.title}`,
            link: `/tasks`,
            metadata: {
              task_id: task.id,
              ticket_id: ticketId,
              assigner_id: user.id,
              assigner_name: assignerName,
            },
          });

        if (assignNotifError) console.error('Failed to create assignment notification:', assignNotifError);
      }
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

  const toggleCheckboxMutation = useMutation({
    mutationFn: async ({ messageId, currentBody }: { messageId: string; currentBody: string }) => {
      // Toggle the checkbox symbol
      const isCurrentlyChecked = currentBody.startsWith('☑');
      const newBody = isCurrentlyChecked 
        ? currentBody.replace('☑', '☐')
        : currentBody.replace('☐', '☑');

      const { error } = await supabase
        .from("helpdesk_messages")
        .update({ body: newBody })
        .eq("id", messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to toggle checkbox",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "note": return <StickyNote className="h-4 w-4" />;
      case "internal_note": return <StickyNote className="h-4 w-4" />;
      case "task": return <CheckCircle2 className="h-4 w-4" />;
      case "checklist": return <CheckSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case "email": return "text-blue-600 dark:text-blue-400";
      case "note": return "text-yellow-600 dark:text-yellow-400";
      case "internal_note": return "text-yellow-600 dark:text-yellow-400";
      case "task": return "text-blue-600 dark:text-blue-400";
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
      {/* Header - Optimized */}
      <div className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold mb-1 line-clamp-2">{ticket?.subject || "Loading..."}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">{ticket?.ticket_number}</Badge>
              {ticket?.customer && (
                <>
                  <span>•</span>
                  <span className="font-medium">{ticket.customer.name}</span>
                </>
              )}
              {ticket?.assigned_user && (
                <>
                  <span>•</span>
                  <Badge variant="secondary" className="text-xs">
                    {ticket.assigned_user.first_name} {ticket.assigned_user.last_name}
                  </Badge>
                </>
              )}
              {ticket?.priority && (
                <>
                  <span>•</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      ticket.priority === "high" && "border-red-500 text-red-600 dark:text-red-400",
                      ticket.priority === "medium" && "border-yellow-500 text-yellow-600 dark:text-yellow-400",
                      ticket.priority === "low" && "border-green-500 text-green-600 dark:text-green-400"
                    )}
                  >
                    {ticket.priority}
                  </Badge>
                </>
              )}
            </div>
          </div>
          {ticket && <TicketActionsMenu ticket={ticket} />}
        </div>
      </div>

      {/* Timeline - Optimized */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full p-3">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              Loading messages...
            </div>
          ) : (
            <div className="space-y-4 pb-4">
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
                    <div key={item.id} className="relative flex items-center justify-center py-3">
                      {/* Center line */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-px h-full bg-border/30" />
                      </div>
                      
                      {/* Audit event badge */}
                      <div className="relative z-10 bg-background px-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border">
                          {item.action === "create" ? (
                            <Link className="h-3 w-3 text-primary" />
                          ) : (
                            <Unlink className="h-3 w-3 text-destructive" />
                          )}
                          <span className="font-medium">
                            {item.user?.first_name} {item.user?.last_name}
                          </span>
                          <span>{actionText}</span>
                          <Badge variant="outline" className="text-xs h-4 px-1">
                            {docType.replace("_", " ")}
                          </Badge>
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
                        "absolute top-9 bottom-0 w-0.5",
                        shouldIndent ? "left-8" : "left-4",
                        message.message_type === "email" && message.direction === "inbound" 
                          ? "bg-primary/20" 
                          : message.message_type === "email" && message.direction === "outbound" 
                          ? "bg-accent/20"
                          : message.message_type === "internal_note"
                          ? "bg-yellow-500/20"
                          : message.message_type === "task"
                          ? "bg-blue-500/20"
                          : message.message_type === "checklist"
                          ? "bg-green-500/20"
                          : "bg-border"
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
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-background relative z-10 shadow-sm",
                        message.message_type === "email" && message.direction === "inbound" 
                          ? "border-primary/50 bg-primary/5" 
                          : message.message_type === "email" && message.direction === "outbound" 
                          ? "border-accent/50 bg-accent/5"
                          : message.message_type === "internal_note"
                          ? "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20"
                          : message.message_type === "task"
                          ? "border-blue-500/50 bg-blue-50 dark:bg-blue-950/20"
                          : message.message_type === "checklist"
                          ? "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                          : "border-border"
                      )}>
                        <div className={getMessageTypeColor(message.message_type)}>
                          {getMessageIcon(message.message_type)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                         <div className={cn(
                          "bg-card border rounded-md p-2.5 shadow-sm hover:shadow-md transition-shadow",
                          message.direction === "inbound" && "border-l-4 border-l-primary/40",
                          message.direction === "outbound" && "border-l-4 border-l-accent/40",
                          message.message_type === "internal_note" && "bg-yellow-50/50 dark:bg-yellow-950/10 border-yellow-200 dark:border-yellow-900",
                          message.message_type === "task" && "bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900",
                          message.message_type === "checklist" && "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900"
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
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(message.sent_at || message.created_at), { addSuffix: true })}
                            </span>
                            {isEmail && (
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    composerRef.current?.reset();
                                    setTimeout(() => {
                                      const composer = document.querySelector('[data-composer]') as HTMLElement;
                                      composer?.click();
                                    }, 100);
                                  }}
                                  className="h-6 px-2 text-xs"
                                  title="Reply"
                                >
                                  <CornerDownRight className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Copy email to clipboard
                                    navigator.clipboard.writeText(message.body_html || message.body_text || message.body || '');
                                    toast({ title: "Email copied to clipboard" });
                                  }}
                                  className="h-6 px-2 text-xs"
                                  title="Copy"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
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
                          ) : message.message_type === "checklist" ? (
                            (() => {
                              const taskMatch = message.body.match(/^[☐☑]\s+(.+)$/);
                              const taskTitle = taskMatch ? taskMatch[1] : message.body.replace(/^[☐☑]\s*/, '');
                              const isCompleted = message.body.startsWith('☑');
                              
                              return (
                                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => toggleCheckboxMutation.mutate({ 
                                        messageId: message.id, 
                                        currentBody: message.body 
                                      })}
                                      disabled={toggleCheckboxMutation.isPending}
                                      className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer",
                                        "hover:scale-110 active:scale-95",
                                        isCompleted 
                                          ? 'bg-green-500 border-green-500 hover:bg-green-600' 
                                          : 'border-green-400 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/30',
                                        toggleCheckboxMutation.isPending && 'opacity-50 cursor-not-allowed'
                                      )}
                                    >
                                      {isCompleted && <CheckSquare className="h-4 w-4 text-white fill-white" />}
                                    </button>
                                    <span className={cn(
                                      "text-sm font-medium",
                                      isCompleted && 'line-through text-muted-foreground'
                                    )}>
                                      {taskTitle}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()
                          ) : message.message_type === "task" ? (
                            <div className="space-y-2">
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                                <div className="whitespace-pre-wrap text-sm font-medium">
                                  {message.body.replace('Task created: ', '')}
                                </div>
                              </div>
                            </div>
                          ) : message.message_type === "internal_note" ? (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                              <div className="whitespace-pre-wrap text-sm">{renderMentions(message.body_text || message.body || "")}</div>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap text-sm">{renderMentions(message.body_text || message.body || "")}</div>
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
              <div className="relative flex flex-col gap-2 py-6">
                {/* Center line */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-px h-full bg-border/30" />
                </div>
                
                {/* Action Buttons */}
                {!showNoteEditor && !showTaskEditor && !showCheckboxEditor && (
                  <div className="relative flex items-center gap-2 bg-background px-3 justify-center flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNoteEditor(true)}
                      className="h-8 gap-2 shadow-sm hover:shadow-md transition-all"
                    >
                      <StickyNote className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs font-medium">Add Note</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTaskEditor(true)}
                      className="h-8 gap-2 shadow-sm hover:shadow-md transition-all"
                    >
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium">Add Task</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCheckboxEditor(true)}
                      className="h-8 gap-2 shadow-sm hover:shadow-md transition-all"
                    >
                      <CheckSquare className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium">Add Checkbox</span>
                    </Button>
                  </div>
                )}

                {/* Inline Editors */}
                {showNoteEditor && (
                  <div className="relative z-10 px-2">
                    <InlineNoteEditor
                      onSave={async (content, mentions) => {
                        await createNoteMutation.mutateAsync({ content, mentions });
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
      <div data-composer>
        <EmailComposer
          ref={composerRef}
          onSend={(emailData) => sendReplyMutation.mutate(emailData)}
          defaultTo={ticket?.sender_email || ticket?.external_email || ""}
          defaultSubject={ticket?.subject ? `RE: ${ticket.subject}` : ""}
          isSending={sendReplyMutation.isPending}
          ticketId={ticketId}
          emailThread={emailThread}
        />
      </div>
    </div>
  );
}
