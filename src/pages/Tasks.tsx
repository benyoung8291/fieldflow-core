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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Filter, Calendar, User, Link as LinkIcon, ExternalLink, List, Kanban, ChevronDown, CheckSquare } from "lucide-react";
import TaskDialog, { TaskFormData } from "@/components/tasks/TaskDialog";
import TaskKanbanView from "@/components/tasks/TaskKanbanView";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import DraggableTaskCard from "@/components/tasks/DraggableTaskCard";
export default function Tasks() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("my-tasks");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeTask, setActiveTask] = useState<any>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [groupMode, setGroupMode] = useState<'status' | 'tag' | 'document'>('status');
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
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'list' && <div className="flex items-center border rounded-lg p-1 bg-muted/30">
                <Button variant={groupMode === 'status' ? 'default' : 'ghost'} size="sm" onClick={() => setGroupMode('status')}>
                  Status
                </Button>
                <Button variant={groupMode === 'tag' ? 'default' : 'ghost'} size="sm" onClick={() => setGroupMode('tag')}>
                  Tag
                </Button>
                <Button variant={groupMode === 'document' ? 'default' : 'ghost'} size="sm" onClick={() => setGroupMode('document')}>
                  Document
                </Button>
              </div>}
            <div className="flex items-center border rounded-lg p-1 bg-muted/30">
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewModeChange('list')} className="gap-2">
                <List className="h-4 w-4" />
                List
              </Button>
              <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewModeChange('kanban')} className="gap-2">
                <Kanban className="h-4 w-4" />
                Kanban
              </Button>
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
            <div className="grid gap-2 md:grid-cols-6">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>

              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="h-8 text-sm">
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
                <SelectTrigger className="h-8 text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map(tag => <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>)}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={() => {
              setFilterStatus("all");
              setFilterPriority("all");
              setFilterAssignee("my-tasks");
              setFilterTag("all");
              setSearchQuery("");
            }}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List or Kanban View */}
        {viewMode === 'kanban' ? <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <TaskKanbanView tasks={tasksWithUsers} onTaskClick={task => {
          setSelectedTask(task);
          setIsDialogOpen(true);
        }} onNavigateToLinked={(module, id) => navigate(getModuleRoute(module, id))} kanbanMode={userProfile?.task_kanban_mode || 'business_days'} />
            <DragOverlay>
              {activeTask ? <DraggableTaskCard task={activeTask} onTaskClick={() => {}} onNavigateToLinked={() => {}} subtaskCount={activeTask.subtaskCount} completedSubtaskCount={activeTask.completedSubtaskCount} /> : null}
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
          </Card> : <div className="space-y-6">
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
                      {groupTasks.map((task: any) => <div key={task.id} className="group flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => {
                setSelectedTask(task);
                setIsDialogOpen(true);
              }}>
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
                </div>;
        })}
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
    </DashboardLayout>;
}