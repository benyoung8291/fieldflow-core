import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Plus, Search, Filter, Calendar, User, Link as LinkIcon, ExternalLink, List, Kanban, ChevronDown, CheckSquare, MessageSquare, Send } from "lucide-react";
import TaskDialog, { TaskFormData } from "@/components/tasks/TaskDialog";
import TaskKanbanView from "@/components/tasks/TaskKanbanView";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import DraggableTaskCard from "@/components/tasks/DraggableTaskCard";
export default function Tasks() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("my-tasks");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeTask, setActiveTask] = useState<any>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [groupMode, setGroupMode] = useState<'status' | 'tag' | 'document'>('status');
  const [kanbanViewMode, setKanbanViewMode] = useState<'date' | 'status'>('status');
  const queryClient = useQueryClient();

  // Drag and drop sensors with mobile support
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8
    }
  }), useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5
    }
  }));
  const getModuleRoute = (module: string, id: string) => {
    const routes: Record<string, string> = {
      customer: `/customers/${id}`,
      lead: `/leads/${id}`,
      project: `/projects/${id}`,
      quote: `/quotes/${id}`,
      service_order: `/service-orders/${id}`,
      appointment: `/appointments/${id}`,
      invoice: `/invoices/${id}`,
      contract: `/service-contracts/${id}`
    };
    return routes[module] || '#';
  };
  const {
    data: currentUser
  } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      return user;
    }
  });

  // Fetch user profile for view preference and kanban mode
  const {
    data: userProfile
  } = useQuery({
    queryKey: ["user-profile-tasks"],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return null;
      const {
        data,
        error
      } = await supabase.from("profiles").select("task_view_preference, task_kanban_mode").eq("id", user.id).single();
      if (error) throw error;
      return data;
    }
  });

  // Set view mode from user profile
  useEffect(() => {
    if (userProfile?.task_view_preference) {
      setViewMode(userProfile.task_view_preference as 'list' | 'kanban');
    }
  }, [userProfile]);

  // Save view preference mutation
  const saveViewPreference = useMutation({
    mutationFn: async (preference: 'list' | 'kanban') => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const {
        error
      } = await supabase.from("profiles").update({
        task_view_preference: preference
      }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user-profile-tasks"]
      });
    }
  });
  const handleViewModeChange = (mode: 'list' | 'kanban') => {
    setViewMode(mode);
    saveViewPreference.mutate(mode);
  };
  const {
    data: workers = []
  } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("profiles").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch task comments
  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask?.id) return [];
      const { data, error } = await supabase
        .from("task_comments" as any)
        .select("*, author:created_by(first_name, last_name)")
        .eq("task_id", selectedTask.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTask?.id,
  });

  // Fetch task activity/audit logs
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["task-activity", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask?.id) return [];
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "tasks")
        .eq("record_id", selectedTask.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTask?.id,
  });

  // Real-time subscription for comments and activity
  useEffect(() => {
    if (!selectedTask?.id) return;
    const channel = supabase
      .channel('task-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${selectedTask.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["task-comments", selectedTask.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_logs',
          filter: `record_id=eq.${selectedTask.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["task-activity", selectedTask.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTask?.id, queryClient]);

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();
      if (!profile?.tenant_id) throw new Error("No tenant found");
      const { error } = await supabase.from("task_comments" as any).insert({
        tenant_id: profile.tenant_id,
        task_id: selectedTask.id,
        comment,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", selectedTask.id] });
      toast.success("Comment added");
    },
    onError: () => {
      toast.error("Failed to add comment");
    },
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment);
    setShowMentions(false);
    setMentionSearch("");
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setNewComment(value);

    // Check for @ mention trigger
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's no space after @ (still typing the mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt.toLowerCase());
        setMentionPosition(lastAtIndex);
        setShowMentions(true);
        setSelectedMentionIndex(0);
        return;
      }
    }
    
    setShowMentions(false);
    setMentionSearch("");
  };

  const filteredMentionUsers = useMemo(() => {
    if (!mentionSearch) return workers;
    return workers.filter((worker: any) => 
      `${worker.first_name} ${worker.last_name}`.toLowerCase().includes(mentionSearch)
    );
  }, [workers, mentionSearch]);

  const insertMention = (worker: any) => {
    const beforeMention = newComment.slice(0, mentionPosition);
    const afterMention = newComment.slice(mentionPosition + mentionSearch.length + 1);
    const mention = `@${worker.first_name} ${worker.last_name}`;
    setNewComment(`${beforeMention}${mention} ${afterMention}`);
    setShowMentions(false);
    setMentionSearch("");
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev < filteredMentionUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && filteredMentionUsers.length > 0) {
      e.preventDefault();
      insertMention(filteredMentionUsers[selectedMentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentions(false);
      setMentionSearch("");
    }
  };

  const renderCommentWithMentions = (text: string) => {
    // Match @FirstName LastName pattern
    const mentionRegex = /@([A-Za-z]+\s[A-Za-z]+)/g;
    const parts = text.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a mention
        return (
          <span key={index} className="bg-primary/10 text-primary rounded px-1 font-medium">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const getActivityDescription = (log: any) => {
    if (log.action === 'create') {
      return 'created this task';
    }
    if (log.action === 'delete') {
      return 'deleted this task';
    }
    if (log.action === 'update' && log.field_name) {
      const fieldLabels: Record<string, string> = {
        'title': 'title',
        'description': 'description',
        'status': 'status',
        'priority': 'priority',
        'assigned_to': 'assignee',
        'due_date': 'due date',
        'tags': 'tags',
        'start_date': 'start date',
        'end_date': 'end date',
        'estimated_hours': 'estimated hours',
        'progress_percentage': 'progress'
      };
      
      const field = fieldLabels[log.field_name] || log.field_name;
      
      // Format values for display
      let oldVal = log.old_value;
      let newVal = log.new_value;
      
      if (log.field_name === 'status') {
        oldVal = statusLabels[oldVal] || oldVal;
        newVal = statusLabels[newVal] || newVal;
      }
      
      if (log.field_name === 'assigned_to') {
        const oldUser = workers.find((w: any) => w.id === oldVal);
        const newUser = workers.find((w: any) => w.id === newVal);
        oldVal = oldUser ? `${oldUser.first_name} ${oldUser.last_name}` : 'Unassigned';
        newVal = newUser ? `${newUser.first_name} ${newUser.last_name}` : 'Unassigned';
      }
      
      if (log.field_name === 'due_date' && newVal) {
        newVal = format(new Date(newVal), "MMM d, yyyy");
      }
      
      if (oldVal && newVal) {
        return (
          <>
            changed <span className="font-medium">{field}</span> from{' '}
            <span className="text-muted-foreground">{oldVal}</span> to{' '}
            <span className="font-medium">{newVal}</span>
          </>
        );
      } else if (newVal) {
        return (
          <>
            set <span className="font-medium">{field}</span> to{' '}
            <span className="font-medium">{newVal}</span>
          </>
        );
      } else {
        return (
          <>
            cleared <span className="font-medium">{field}</span>
          </>
        );
      }
    }
    return 'made a change';
  };

  const {
    data: tasks = [],
    isLoading
  } = useQuery({
    queryKey: ["tasks", filterStatus, filterPriority, filterAssignee, searchQuery],
    queryFn: async () => {
      let query = supabase.from("tasks" as any).select("*").order("due_date", {
        ascending: true,
        nullsFirst: false
      }).order("priority", {
        ascending: false
      });

      // Filter by assignee (default: my tasks)
      if (filterAssignee === "my-tasks" && currentUser) {
        query = query.eq("assigned_to", currentUser.id);
      } else if (filterAssignee !== "all" && filterAssignee !== "my-tasks") {
        query = query.eq("assigned_to", filterAssignee);
      }

      // Filter by status
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Filter by priority
      if (filterPriority !== "all") {
        query = query.eq("priority", filterPriority);
      }

      // Search
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;

      // Client-side tag filtering (since tags are array)
      let filteredData = data || [];
      if (filterTag !== "all") {
        filteredData = filteredData.filter((task: any) => task.tags && task.tags.includes(filterTag));
      }

      // Fetch linked record names and format document types
      const tasksWithLinks = await Promise.all(filteredData.map(async (task: any) => {
        // Fetch subtask counts
        const {
          data: subtasks
        } = await supabase.from("tasks").select("id, status").eq("parent_task_id", task.id);
        const subtaskCount = subtasks?.length || 0;
        const completedSubtaskCount = subtasks?.filter((st: any) => st.status === "completed").length || 0;
        if (!task.linked_module || !task.linked_record_id) {
          return {
            ...task,
            subtaskCount,
            completedSubtaskCount
          };
        }
        let linkedRecordName = null;
        let documentType = task.linked_module;
        try {
          let tableName = task.linked_module;
          let nameField = 'name';

          // Map module to table and field names
          if (task.linked_module === 'service_order') {
            tableName = 'service_orders';
            nameField = 'title';
          } else if (task.linked_module === 'quote') {
            tableName = 'quotes';
            nameField = 'title';
          } else if (task.linked_module === 'project') {
            tableName = 'projects';
            nameField = 'name';
          } else if (task.linked_module === 'customer') {
            tableName = 'customers';
            nameField = 'name';
          } else if (task.linked_module === 'lead') {
            tableName = 'leads';
            nameField = 'name';
          } else if (task.linked_module === 'appointment') {
            tableName = 'appointments';
            nameField = 'title';
          } else if (task.linked_module === 'invoice') {
            tableName = 'invoices';
            nameField = 'invoice_number';
          } else if (task.linked_module === 'contract') {
            tableName = 'service_contracts';
            nameField = 'name';
          }
          const {
            data: linkedData
          } = await supabase.from(tableName).select(nameField).eq('id', task.linked_record_id).maybeSingle();
          if (linkedData) {
            linkedRecordName = (linkedData as any)[nameField] || null;
          }

          // Format document type for display
          documentType = task.linked_module.replace('_', ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        } catch (e) {
          console.error('Error fetching linked record:', e);
        }
        return {
          ...task,
          linked_record_name: linkedRecordName,
          document_type: documentType,
          subtaskCount,
          completedSubtaskCount
        };
      }));
      return tasksWithLinks;
    }
  });

  // Fetch assigned users data
  const {
    data: assignedUsersData = []
  } = useQuery({
    queryKey: ["assigned-users-data", tasks.map((t: any) => t?.assigned_to).filter(Boolean)],
    queryFn: async () => {
      const userIds = [...new Set(tasks.map((t: any) => t?.assigned_to).filter(Boolean))];
      if (userIds.length === 0) return [];
      const {
        data,
        error
      } = await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: tasks.length > 0
  });

  // Merge assigned user data with tasks
  const tasksWithUsers = tasks.map((task: any) => ({
    ...task,
    assigned_user: assignedUsersData.find((u: any) => u.id === task.assigned_to)
  }));

  // Extract unique tags from all tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach((task: any) => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach((tag: string) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {
      'pending': [],
      'in_progress': [],
      'completed': [],
      'cancelled': []
    };
    tasksWithUsers.forEach((task: any) => {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    });
    return groups;
  }, [tasksWithUsers]);

  // Group tasks by tag
  const groupedByTag = useMemo(() => {
    const groups: Record<string, any[]> = {
      'untagged': []
    };
    tasksWithUsers.forEach((task: any) => {
      if (!task.tags || task.tags.length === 0) {
        groups['untagged'].push(task);
      } else {
        task.tags.forEach((tag: string) => {
          if (!groups[tag]) {
            groups[tag] = [];
          }
          groups[tag].push(task);
        });
      }
    });
    return groups;
  }, [tasksWithUsers]);

  // Group tasks by document type
  const groupedByDocument = useMemo(() => {
    const groups: Record<string, any[]> = {
      'no_link': []
    };
    tasksWithUsers.forEach((task: any) => {
      if (!task.document_type) {
        groups['no_link'].push(task);
      } else {
        if (!groups[task.document_type]) {
          groups[task.document_type] = [];
        }
        groups[task.document_type].push(task);
      }
    });
    return groups;
  }, [tasksWithUsers]);
  const statusLabels: Record<string, string> = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'completed': 'Complete',
    'cancelled': 'Cancelled'
  };
  const documentTypeLabels: Record<string, string> = {
    'customer': 'Customer',
    'lead': 'Lead',
    'project': 'Project',
    'quote': 'Quote',
    'service_order': 'Service Order',
    'appointment': 'Appointment',
    'invoice': 'Invoice',
    'contract': 'Contract',
    'no_link': 'Not Linked'
  };
  const toggleSection = (status: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: TaskFormData) => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const {
        data: profile
      } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile?.tenant_id) throw new Error("No tenant found");
      const {
        data: newTask,
        error
      } = await supabase.from("tasks" as any).insert({
        tenant_id: profile.tenant_id,
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        assigned_to: taskData.assigned_to || null,
        due_date: taskData.due_date?.toISOString() || null,
        start_date: taskData.start_date?.toISOString().split('T')[0] || null,
        end_date: taskData.end_date?.toISOString().split('T')[0] || null,
        estimated_hours: taskData.estimated_hours ? parseFloat(taskData.estimated_hours) : null,
        progress_percentage: taskData.progress_percentage ? parseInt(taskData.progress_percentage) : 0,
        tags: taskData.tags || [],
        created_by: user.id
      }).select().single();
      if (error) throw error;

      // Apply checklist items if provided
      const checklistItems = (taskData as any)._checklistItems;
      if (checklistItems && checklistItems.length > 0 && newTask) {
        const checklistData = checklistItems.map((item: any) => ({
          task_id: (newTask as any).id,
          title: item.title,
          item_order: item.item_order
        }));
        await supabase.from("task_checklist_items" as any).insert(checklistData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks"]
      });
      toast.success("Task created successfully");
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to create task");
    }
  });
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: string;
      data: Partial<TaskFormData>;
    }) => {
      // Get current task and user info for notification
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: currentTask, error: fetchError } = await supabase
        .from("tasks" as any)
        .select("assigned_to, title, tenant_id")
        .eq("id", id)
        .single();

      if (fetchError || !currentTask) throw fetchError || new Error("Task not found");
      
      const oldAssignedTo = (currentTask as any).assigned_to as string | null;
      const taskTitle = (currentTask as any).title as string;
      const tenantId = (currentTask as any).tenant_id as string;

      const {
        error
      } = await supabase.from("tasks" as any).update({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigned_to: data.assigned_to || null,
        due_date: data.due_date?.toISOString() || null,
        start_date: data.start_date?.toISOString()?.split('T')[0] || null,
        end_date: data.end_date?.toISOString()?.split('T')[0] || null,
        estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
        progress_percentage: data.progress_percentage ? parseInt(data.progress_percentage) : 0,
        tags: data.tags || [],
        completed_at: data.status === "completed" ? new Date().toISOString() : null
      }).eq("id", id);
      if (error) throw error;

      // Create notification if assigned user changed
      if (data.assigned_to && data.assigned_to !== oldAssignedTo && data.assigned_to !== user.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single();

        const assignerName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Someone';
        const finalTaskTitle = data.title || taskTitle;

        await supabase.from("notifications" as any).insert({
          tenant_id: tenantId,
          user_id: data.assigned_to,
          type: 'task_assigned',
          title: 'Task Assigned to You',
          message: `${assignerName} assigned you the task: ${finalTaskTitle}`,
          link: `/tasks`,
          metadata: {
            task_id: id,
            assigner_id: user.id,
            assigner_name: assignerName,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks"]
      });
      toast.success("Task updated successfully");
      setSelectedTask(null);
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to update task");
    }
  });
  const toggleTaskStatus = async (task: any) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    updateTaskMutation.mutate({
      id: task.id,
      data: {
        status: newStatus
      } as any
    });
  };

  // Drag handlers for kanban view
  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task;
    if (task) {
      setActiveTask(task);
    }
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    setActiveTask(null);
    if (!over) return;
    const task = active.data.current?.task;
    const newDateKey = over.id as string;
    if (!task || !newDateKey) return;

    // Parse the new date from the column ID (format: yyyy-MM-dd)
    const newDueDate = new Date(newDateKey);

    // Only update if the date actually changed
    const currentDateKey = task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : null;
    if (currentDateKey !== newDateKey) {
      try {
        const {
          error
        } = await supabase.from("tasks").update({
          due_date: newDueDate.toISOString()
        }).eq("id", task.id);
        if (error) throw error;
        queryClient.invalidateQueries({
          queryKey: ["tasks"]
        });
        toast.success("Task date updated");
      } catch (error) {
        console.error("Error updating task:", error);
        toast.error("Failed to update task date");
      }
    }
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };
  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    if (viewMode === 'list') {
      setSidePanelOpen(true);
    } else {
      setIsDialogOpen(true);
    }
  };

  const handleInlineUpdate = (field: string, value: any) => {
    if (!selectedTask) return;
    updateTaskMutation.mutate({
      id: selectedTask.id,
      data: { [field]: value } as any
    });
    setSelectedTask({ ...selectedTask, [field]: value });
  };

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle !== selectedTask?.title) {
      handleInlineUpdate('title', editTitle);
    }
    setEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (editDescription !== selectedTask?.description) {
      handleInlineUpdate('description', editDescription);
    }
    setEditingDescription(false);
  };

  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode and Kanban Mode Toggle */}
            <div className="flex gap-2">
              {viewMode === 'kanban' && (
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <Button
                    variant={kanbanViewMode === 'status' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setKanbanViewMode('status')}
                    className="h-8 text-xs"
                  >
                    Status
                  </Button>
                  <Button
                    variant={kanbanViewMode === 'date' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setKanbanViewMode('date')}
                    className="h-8 text-xs"
                  >
                    Date
                  </Button>
                </div>
              )}
              
              {viewMode === 'list' && <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <Button variant={groupMode === 'status' ? 'default' : 'ghost'} size="sm" onClick={() => setGroupMode('status')} className="h-8 text-xs">
                    Status
                  </Button>
                  <Button variant={groupMode === 'tag' ? 'default' : 'ghost'} size="sm" onClick={() => setGroupMode('tag')} className="h-8 text-xs">
                    Tag
                  </Button>
                  <Button variant={groupMode === 'document' ? 'default' : 'ghost'} size="sm" onClick={() => setGroupMode('document')} className="h-8 text-xs">
                    Document
                  </Button>
                </div>}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewModeChange('list')} className="h-8 px-3 gap-1.5">
                  <List className="h-4 w-4" />
                  List
                </Button>
                <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewModeChange('kanban')} className="h-8 px-3 gap-1.5">
                  <Kanban className="h-4 w-4" />
                  Kanban
                </Button>
              </div>
            </div>
            <Button onClick={() => {
            setSelectedTask(null);
            setIsDialogOpen(true);
          }}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex gap-2 flex-1 min-w-[300px]">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>

                <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                  <SelectTrigger className="h-8 text-sm w-40">
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="my-tasks">My Tasks</SelectItem>
                  <SelectItem value="all">All Tasks</SelectItem>
                  {workers.filter(w => w.id && w.id.trim()).map(worker => <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name}
                      </SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-8 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              {allTags.length > 0 && (
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="h-8 text-sm w-40">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List or Kanban View */}
        {viewMode === 'kanban' ? <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <TaskKanbanView 
              tasks={tasksWithUsers} 
              onTaskClick={handleTaskClick} 
              viewMode={kanbanViewMode}
            />
            <DragOverlay dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}>
              {activeTask ? (
                <div className="opacity-90 cursor-grabbing">
                  <DraggableTaskCard 
                    task={activeTask} 
                    onTaskClick={() => {}} 
                    onNavigateToLinked={() => {}} 
                    workerName={activeTask.assigned_user ? `${activeTask.assigned_user.first_name} ${activeTask.assigned_user.last_name}` : undefined}
                    subtaskCount={activeTask.subtaskCount || 0} 
                    completedSubtaskCount={activeTask.completedSubtaskCount || 0} 
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext> : isLoading ? <div className="space-y-3">
            {Array.from({
          length: 5
        }).map((_, i) => <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>)}
          </div> : tasksWithUsers.length === 0 ? <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No tasks found</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first task to get started</p>
            </CardContent>
          </Card> : <div className={cn("flex gap-0", sidePanelOpen && "relative")}>
            <div className={cn("transition-all duration-200", sidePanelOpen ? "w-[60%]" : "w-full")}>
              <div className="space-y-6">
            {Object.entries(groupMode === 'status' ? groupedTasks : groupMode === 'tag' ? groupedByTag : groupedByDocument).map(([groupKey, groupTasks]) => {
          if (groupTasks.length === 0) return null;
          const displayLabel = groupMode === 'status' ? statusLabels[groupKey] : groupMode === 'tag' ? groupKey === 'untagged' ? 'Untagged' : groupKey : documentTypeLabels[groupKey] || groupKey;
          return <div key={groupKey} className="space-y-2">
                  <button onClick={() => toggleSection(groupKey)} className="flex items-center gap-2 w-full text-left group hover:text-foreground transition-colors">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", collapsedSections[groupKey] && "-rotate-90")} />
                    <h3 className="text-sm font-semibold text-muted-foreground group-hover:text-foreground">
                      {displayLabel}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {groupTasks.length}
                    </span>
                  </button>
                  
                  {!collapsedSections[groupKey] && <div className="space-y-0.5 pl-6">
                      {groupTasks.map((task: any) => <div key={task.id} className={cn("group flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer", selectedTask?.id === task.id && sidePanelOpen && "bg-muted")} onClick={() => handleTaskClick(task)}>
                          <Checkbox checked={task.status === "completed"} onCheckedChange={() => toggleTaskStatus(task)} onClick={e => e.stopPropagation()} className="mt-0.5 h-3.5 w-3.5" />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <h4 className={cn("text-xs font-medium leading-tight", task.status === "completed" && "line-through text-muted-foreground")}>
                                {task.title}
                              </h4>
                              
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {task.tags && task.tags.length > 0 && task.tags.slice(0, 2).map((tag: string, index: number) => <Badge key={index} variant="secondary" className="text-[10px] h-4 px-1.5">
                                    {tag}
                                  </Badge>)}
                                <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", getPriorityColor(task.priority))}>
                                  {task.priority}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                              {task.due_date && <div className="flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  <span>{format(new Date(task.due_date), "MMM d")}</span>
                                </div>}
                              
                              {task.assigned_user && <div className="flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" />
                                  <span>{task.assigned_user.first_name}</span>
                                </div>}
                              
                              {task.subtaskCount > 0 && <div className="flex items-center gap-0.5">
                                  <CheckSquare className="h-2.5 w-2.5" />
                                  <span>{task.completedSubtaskCount}/{task.subtaskCount}</span>
                                </div>}
                              
                              {task.linked_module && task.linked_record_name && <div className="flex items-center gap-0.5 text-primary hover:underline" onClick={e => {
                      e.stopPropagation();
                      navigate(getModuleRoute(task.linked_module, task.linked_record_id));
                    }}>
                                  <LinkIcon className="h-2.5 w-2.5" />
                                  <span>{task.linked_record_name}</span>
                                </div>}
                            </div>
                          </div>
                        </div>)}
                    </div>}
                </div>
        })}
              </div>
            </div>

            {/* Side Panel for Task Details */}
            {sidePanelOpen && selectedTask && <div className="w-[40%] border-l border-border bg-background h-[calc(100vh-12rem)] flex flex-col sticky top-0">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleTaskStatus(selectedTask)}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {selectedTask.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
                  </Button>
                  
                  <TooltipProvider>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => setLinkDialogOpen(true)}
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Link to document</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => setAssignDialogOpen(true)}
                          >
                            <User className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Assign task</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => setSidePanelOpen(false)}
                          >
                            <ExternalLink className="h-4 w-4 rotate-180" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Close panel</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                  {/* Task Title - Inline Editable */}
                  {editingTitle ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleSave();
                        if (e.key === 'Escape') {
                          setEditTitle(selectedTask.title);
                          setEditingTitle(false);
                        }
                      }}
                      autoFocus
                      className="text-xl font-semibold"
                    />
                  ) : (
                    <h2 
                      className="text-xl font-semibold leading-tight cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                      onClick={() => setEditingTitle(true)}
                    >
                      {selectedTask.title}
                    </h2>
                  )}

                  {/* Status and Priority Badges - Inline Editable */}
                  <div className="flex items-center gap-1.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge className={cn("text-[10px] h-5 px-2 cursor-pointer hover:opacity-80", getStatusColor(selectedTask.status))}>
                          {statusLabels[selectedTask.status]}
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1" align="start">
                        <div className="space-y-0.5">
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <Button
                              key={value}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start h-8 text-xs"
                              onClick={() => handleInlineUpdate('status', value)}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Badge variant="outline" className={cn("text-[10px] h-5 px-2 cursor-pointer hover:bg-muted", getPriorityColor(selectedTask.priority))}>
                          {selectedTask.priority}
                        </Badge>
                      </PopoverTrigger>
                      <PopoverContent className="w-32 p-1" align="start">
                        <div className="space-y-0.5">
                          {['low', 'medium', 'high', 'urgent'].map((priority) => (
                            <Button
                              key={priority}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start h-8 text-xs capitalize"
                              onClick={() => handleInlineUpdate('priority', priority)}
                            >
                              {priority}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Key Details - Compact Grid */}
                  <div className="space-y-2.5">
                    {/* Assignee - Inline Editable */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Assignee</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2">
                            {selectedTask.assigned_user ? <>
                                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs truncate">{selectedTask.assigned_user.first_name} {selectedTask.assigned_user.last_name}</span>
                              </> : <span className="text-xs text-muted-foreground">Unassigned</span>}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-1" align="start">
                          <div className="space-y-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start h-8 text-xs"
                              onClick={() => handleInlineUpdate('assigned_to', null)}
                            >
                              Unassigned
                            </Button>
                            {workers.map((worker: any) => (
                              <Button
                                key={worker.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start h-8 text-xs"
                                onClick={() => handleInlineUpdate('assigned_to', worker.id)}
                              >
                                {worker.first_name} {worker.last_name}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Due Date - Inline Editable */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Due date</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs">
                              {selectedTask.due_date ? format(new Date(selectedTask.due_date), "MMM d, yyyy") : "No date"}
                            </span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={selectedTask.due_date ? new Date(selectedTask.due_date) : undefined}
                            onSelect={(date) => handleInlineUpdate('due_date', date)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Linked Document */}
                    {selectedTask.linked_module && selectedTask.linked_record_name && <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Project</span>
                        <div className="flex items-center gap-1.5 text-primary cursor-pointer hover:underline" onClick={e => {
                    e.stopPropagation();
                    navigate(getModuleRoute(selectedTask.linked_module, selectedTask.linked_record_id));
                  }}>
                          <LinkIcon className="h-3.5 w-3.5" />
                          <span className="text-xs truncate">{selectedTask.linked_record_name}</span>
                        </div>
                      </div>}

                    {/* Tags */}
                    {selectedTask.tags && selectedTask.tags.length > 0 && <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Tags</span>
                        <div className="flex flex-wrap gap-1 flex-1">
                          {selectedTask.tags.map((tag: string, index: number) => <Badge key={index} variant="secondary" className="text-[10px] h-4 px-1.5">
                              {tag}
                            </Badge>)}
                        </div>
                      </div>}
                  </div>

                  {/* Description - Inline Editable */}
                  <div className="space-y-1.5 pt-2 border-t">
                    <h3 className="text-xs font-medium text-muted-foreground">Description</h3>
                    {editingDescription ? (
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        onBlur={handleDescriptionSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditDescription(selectedTask.description || "");
                            setEditingDescription(false);
                          }
                        }}
                        autoFocus
                        className="min-h-[100px] text-xs resize-none"
                      />
                    ) : (
                      <p 
                        className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 min-h-[40px]"
                        onClick={() => setEditingDescription(true)}
                      >
                        {selectedTask.description || "Click to add description..."}
                      </p>
                    )}
                  </div>

                  {/* Subtasks Count */}
                  {selectedTask.subtaskCount > 0 && <div className="space-y-1.5 pt-2 border-t">
                      <h3 className="text-xs font-medium text-muted-foreground">Subtasks</h3>
                      <div className="flex items-center gap-1.5 text-xs">
                        <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{selectedTask.completedSubtaskCount} of {selectedTask.subtaskCount} completed</span>
                      </div>
                    </div>}

                  {/* Activity Timeline */}
                  <div className="space-y-1.5 pt-2 border-t">
                    <h3 className="text-xs font-medium text-muted-foreground">Activity</h3>
                    <div className="space-y-3 mt-2">
                      {activityLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No activity yet</p>
                      ) : (
                        activityLogs.map((log: any) => (
                          <div key={log.id} className="flex gap-2 text-xs">
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                <span className="text-[10px] font-medium">
                                  {log.user_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??'}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="font-medium text-foreground">{log.user_name || 'Unknown'}</span>
                                <span className="text-foreground/70">{getActivityDescription(log)}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => {
                  setSidePanelOpen(false);
                  setIsDialogOpen(true);
                }} className="w-full h-8 text-xs">
                      Edit Task Details
                    </Button>
                  </div>
                </div>

                {/* Comments Section */}
                <div className="border-t bg-muted/20 flex-shrink-0 flex flex-col max-h-[40%]">
                  <div className="px-4 py-2 border-b bg-background/50 flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-medium">Comments ({comments.length})</h3>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 p-3 space-y-2">
                    {comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                    ) : (
                      comments.map((comment: any) => (
                        <div key={comment.id} className="flex gap-2 text-xs">
                          <Avatar className="h-6 w-6 flex-shrink-0">
                            <AvatarFallback className="text-[10px]">
                              {comment.author?.first_name?.[0]}{comment.author?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="font-medium text-foreground">
                                {comment.author?.first_name} {comment.author?.last_name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-foreground/80 leading-snug whitespace-pre-wrap break-words">
                              {renderCommentWithMentions(comment.comment)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="p-2 border-t bg-background relative">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Textarea 
                          value={newComment}
                          onChange={handleCommentChange}
                          onKeyDown={(e) => {
                            handleMentionKeyDown(e);
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !showMentions) {
                              handleSubmitComment();
                            }
                          }}
                          placeholder="Add a comment... (use @ to mention)"
                          className="min-h-[60px] text-xs resize-none"
                        />
                        
                        {/* Mention Autocomplete Dropdown */}
                        {showMentions && filteredMentionUsers.length > 0 && (
                          <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                            <div className="p-1">
                              {filteredMentionUsers.map((worker: any, index: number) => (
                                <button
                                  key={worker.id}
                                  type="button"
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded text-xs hover:bg-muted transition-colors flex items-center gap-2",
                                    index === selectedMentionIndex && "bg-muted"
                                  )}
                                  onClick={() => insertMention(worker)}
                                  onMouseEnter={() => setSelectedMentionIndex(index)}
                                >
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[10px]">
                                      {worker.first_name[0]}{worker.last_name[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{worker.first_name} {worker.last_name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || createCommentMutation.isPending}
                        className="h-[60px] px-3"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                      Use @ to mention · Cmd/Ctrl + Enter to send
                    </p>
                  </div>
                </div>
              </div>}
          </div>}
      </div>

      <TaskDialog open={isDialogOpen} onOpenChange={open => {
      setIsDialogOpen(open);
      if (!open) setSelectedTask(null);
    }} onSubmit={data => {
      if (selectedTask) {
        updateTaskMutation.mutate({
          id: selectedTask.id,
          data
        });
      } else {
        createTaskMutation.mutate(data);
      }
    }} taskId={selectedTask?.id} defaultValues={selectedTask ? {
      title: selectedTask.title,
      description: selectedTask.description || "",
      status: selectedTask.status,
      priority: selectedTask.priority,
      assigned_to: selectedTask.assigned_to || undefined,
      due_date: selectedTask.due_date ? new Date(selectedTask.due_date) : undefined
    } : undefined} linkedModule={selectedTask?.linked_module} linkedRecordId={selectedTask?.linked_record_id} linkedRecordName={selectedTask?.linked_record_name} workers={workers} />
      
      {/* Link Document Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Document to Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This feature will be available soon. Use the main task dialog to link documents.</p>
            <Button variant="outline" onClick={() => {
              setLinkDialogOpen(false);
              setIsDialogOpen(true);
            }}>
              Open Task Dialog
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignee</label>
              <Select 
                value={selectedTask?.assigned_to || ""}
                onValueChange={(value) => {
                  if (selectedTask) {
                    updateTaskMutation.mutate({
                      id: selectedTask.id,
                      data: { assigned_to: value } as any
                    });
                    setAssignDialogOpen(false);
                    toast.success("Task assigned successfully");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker: any) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>;
}