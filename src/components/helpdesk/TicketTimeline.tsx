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
import { AttachmentViewer } from "./AttachmentViewer";
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
    mutationFn: async (checkboxData: { items: string[] }) => {
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

      // Create ONE task for the entire checklist
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: `Checklist (${checkboxData.items.length} items)`,
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

      // Create checklist items for the task
      const checklistItems = checkboxData.items.map((item, index) => ({
        task_id: taskData.id,
        title: item,
        is_completed: false,
        item_order: index,
      }));

      const { error: checklistError } = await supabase
        .from("task_checklist_items" as any)
        .insert(checklistItems);

      if (checklistError) throw checklistError;

      // Create ONE message that references the task with created_by set
      const { error: messageError } = await supabase
        .from("helpdesk_messages")
        .insert({
          ticket_id: ticketId,
          message_type: "checklist",
          body: "Checklist",
          tenant_id: profile.tenant_id,
          task_id: taskData.id,
          created_by: user.id,
        });
      
      if (messageError) throw messageError;
    },
    onSuccess: () => {
      toast({ title: "Checklist items created successfully" });
      setShowCheckboxEditor(false);
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create checklist items",
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
    onMutate: async ({ messageId, currentBody }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["helpdesk-messages", ticketId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(["helpdesk-messages", ticketId]);

      // Calculate new body
      const isCurrentlyChecked = currentBody.startsWith('☑');
      const newBody = isCurrentlyChecked 
        ? currentBody.replace('☑', '☐')
        : currentBody.replace('☐', '☑');

      // Optimistically update to the new value
      queryClient.setQueryData(["helpdesk-messages", ticketId], (old: any) => {
        if (!old) return old;
        return old.map((msg: any) => 
          msg.id === messageId ? { ...msg, body: newBody } : msg
        );
      });

      // Return a context object with the snapshotted value
      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(["helpdesk-messages", ticketId], context.previousMessages);
      }
      toast({
        title: "Failed to toggle checkbox",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're in sync with the server
      queryClient.invalidateQueries({ queryKey: ["helpdesk-messages", ticketId] });
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
      {/* Enhanced Header with Clear Hierarchy */}
      <div className="px-5 py-4 border-b bg-gradient-to-r from-background via-background to-muted/10 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Primary: Subject */}
            <h2 className="text-lg font-bold leading-tight line-clamp-2 text-foreground">{ticket?.subject || "Loading..."}</h2>
            
            {/* Secondary: Metadata Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium">Ticket:</span>
                <Badge variant="outline" className="font-mono text-xs">{ticket?.ticket_number}</Badge>
              </div>
              
              {ticket?.customer && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-medium">Customer:</span>
                  <span className="text-foreground font-semibold text-xs truncate">{ticket.customer.name}</span>
                </div>
              )}
              
              {ticket?.assigned_user && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-medium">Assigned:</span>
                  <span className="text-foreground font-semibold text-xs truncate">
                    {ticket.assigned_user.first_name} {ticket.assigned_user.last_name}
                  </span>
                </div>
              )}
              
              {ticket?.priority && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-medium">Priority:</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-semibold",
                      ticket.priority === "urgent" && "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400",
                      ticket.priority === "high" && "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400",
                      ticket.priority === "medium" && "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                      ticket.priority === "low" && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                    )}
                  >
                    {ticket.priority}
                  </Badge>
                </div>
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
                         "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 bg-background relative z-10 shadow-sm transition-all hover:scale-110",
                         message.message_type === "email" && message.direction === "inbound" 
                           ? "border-primary/50 bg-primary/5 hover:border-primary" 
                           : message.message_type === "email" && message.direction === "outbound" 
                           ? "border-accent/50 bg-accent/5 hover:border-accent"
                           : message.message_type === "internal_note"
                           ? "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 hover:border-yellow-500"
                           : message.message_type === "task"
                           ? "border-blue-500/50 bg-blue-50 dark:bg-blue-950/20 hover:border-blue-500"
                           : message.message_type === "checklist"
                           ? "border-green-500/50 bg-green-50 dark:bg-green-950/20 hover:border-green-500"
                           : "border-border"
                       )}>
                         <div className={getMessageTypeColor(message.message_type)}>
                           {getMessageIcon(message.message_type)}
                         </div>
                       </div>

                        <div className="flex-1 min-w-0">
                          <Card className={cn(
                            "p-4 transition-all duration-200 hover:shadow-md",
                            message.direction === "inbound" && "border-l-4 border-l-primary",
                            message.direction === "outbound" && "border-l-4 border-l-accent"
                          )}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getThreadingIcon(message)}
                                  <span className="font-semibold text-sm">
                                    {message.sender_name || message.from_name || "System"}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(message.sent_at || message.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="text-sm">
                              {message.body_html ? (
                                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.body_html) }} />
                              ) : (
                                <div>{message.body_text || message.body}</div>
                              )}
                            </div>
                          </Card>
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
