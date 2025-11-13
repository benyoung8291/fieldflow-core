import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, addDays, isWeekend, isSameDay, startOfDay } from "date-fns";
import { Calendar, User, Link as LinkIcon, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TaskKanbanViewProps {
  tasks: any[];
  onTaskClick: (task: any) => void;
  onNavigateToLinked: (module: string, id: string) => void;
  kanbanMode: string;
}

interface DroppableColumnProps {
  date: Date;
  title: string;
  tasks: any[];
  onTaskClick: (task: any) => void;
  onNavigateToLinked: (module: string, id: string) => void;
}

function DroppableColumn({ date, title, tasks, onTaskClick, onNavigateToLinked }: DroppableColumnProps) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const { isOver, setNodeRef } = useDroppable({
    id: dateKey,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");
      if (error) throw error;
      return data || [];
    },
  });

  const workersMap = useMemo(() => {
    return workers.reduce((acc: any, worker: any) => {
      acc[worker.id] = `${worker.first_name} ${worker.last_name}`;
      return acc;
    }, {});
  }, [workers]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success';
      case 'in_progress': return 'bg-info/10 text-info';
      case 'todo': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-[500px] rounded-lg border bg-card transition-colors",
        isOver && "ring-2 ring-primary"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">
          {title}
          <div className="text-sm font-normal text-muted-foreground mt-1">
            {format(date, 'EEE, MMM d')}
          </div>
        </CardTitle>
        <Badge variant="secondary" className="w-fit">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onTaskClick(task)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
                  <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                    {task.priority}
                  </Badge>
                </div>
                
                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {task.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className={getStatusColor(task.status)}>
                    {task.status.replace('_', ' ')}
                  </Badge>

                  {task.assigned_to && (
                    <Badge variant="outline" className="gap-1">
                      <User className="h-3 w-3" />
                      {workersMap[task.assigned_to] || 'Unknown'}
                    </Badge>
                  )}

                  {task.linked_module && task.linked_record_name && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToLinked(task.linked_module, task.linked_record_id);
                      }}
                    >
                      <LinkIcon className="h-3 w-3" />
                      {task.document_type}: {task.linked_record_name}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </div>
  );
}

export default function TaskKanbanView({ 
  tasks, 
  onTaskClick, 
  onNavigateToLinked,
  kanbanMode 
}: TaskKanbanViewProps) {
  const today = startOfDay(new Date());

  // Calculate the three days to display based on mode
  const getDaysToDisplay = () => {
    const days = [];
    let currentDate = today;
    let daysAdded = 0;

    if (kanbanMode === 'consecutive_days') {
      // Always show today, tomorrow, and the day after
      days.push(today);
      days.push(addDays(today, 1));
      days.push(addDays(today, 2));
    } else if (kanbanMode === 'include_weekends') {
      // Show next 3 calendar days always
      days.push(today);
      days.push(addDays(today, 1));
      days.push(addDays(today, 2));
    } else {
      // business_days: Skip weekends unless there are tasks
      while (daysAdded < 3) {
        if (!isWeekend(currentDate)) {
          days.push(currentDate);
          daysAdded++;
        } else {
          // Check if there are tasks on this weekend day
          const hasTasksOnWeekend = tasks.some(task => {
            if (!task.due_date) return false;
            return isSameDay(new Date(task.due_date), currentDate);
          });
          if (hasTasksOnWeekend) {
            days.push(currentDate);
            daysAdded++;
          }
        }
        currentDate = addDays(currentDate, 1);
      }
    }

    return days;
  };

  const daysToDisplay = getDaysToDisplay();

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    daysToDisplay.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      grouped[dateKey] = [];
    });

    tasks.forEach(task => {
      if (!task.due_date) return;
      
      const taskDate = startOfDay(new Date(task.due_date));
      const dateKey = format(taskDate, 'yyyy-MM-dd');
      
      // Only include tasks that match one of our display days
      if (grouped[dateKey]) {
        grouped[dateKey].push(task);
      }
    });

    return grouped;
  }, [tasks, daysToDisplay]);

  const getColumnTitle = (date: Date, index: number) => {
    if (isSameDay(date, today)) return 'Today';
    if (isSameDay(date, addDays(today, 1))) return 'Tomorrow';
    if (index === 2) return 'Day After';
    return format(date, 'EEEE');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {daysToDisplay.map((date, index) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return (
          <DroppableColumn
            key={dateKey}
            date={date}
            title={getColumnTitle(date, index)}
            tasks={tasksByDate[dateKey] || []}
            onTaskClick={onTaskClick}
            onNavigateToLinked={onNavigateToLinked}
          />
        );
      })}
    </div>
  );
}
