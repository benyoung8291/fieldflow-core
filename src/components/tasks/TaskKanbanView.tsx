import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, addDays, isWeekend, isSameDay, startOfDay, isPast } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DraggableTaskCard from "./DraggableTaskCard";

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
  workersMap: Record<string, string>;
  isToday: boolean;
}

function DroppableColumn({ 
  date, 
  title, 
  tasks, 
  onTaskClick, 
  onNavigateToLinked,
  workersMap,
  isToday 
}: DroppableColumnProps) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const { isOver, setNodeRef } = useDroppable({
    id: dateKey,
  });

  // Sort tasks: overdue first, then by priority
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aOverdue = a.due_date && isPast(startOfDay(new Date(a.due_date))) && a.status !== 'completed';
      const bOverdue = b.due_date && isPast(startOfDay(new Date(b.due_date))) && b.status !== 'completed';
      
      // Overdue tasks come first
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      // Then sort by priority
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
    });
  }, [tasks]);

  return (
    <Card
      className={cn(
        "flex flex-col min-h-[500px]",
        isToday && "ring-2 ring-primary shadow-lg"
      )}
    >
      <CardHeader className={cn(
        "pb-3",
        isToday && "bg-primary/5 border-b border-primary/20"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "text-lg font-semibold",
            isToday && "text-primary"
          )}>
            {title}
            {isToday && <span className="ml-2 text-xs font-normal">(Featured)</span>}
          </CardTitle>
          <Badge variant={isToday ? "default" : "secondary"} className="shrink-0">
            {tasks.length}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {format(date, 'EEE, MMM d')}
        </div>
      </CardHeader>
      
      <CardContent
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 p-3 overflow-y-auto transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        {sortedTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No tasks
          </div>
        ) : (
          sortedTasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onTaskClick={onTaskClick}
              onNavigateToLinked={onNavigateToLinked}
              workerName={task.assigned_to ? workersMap[task.assigned_to] : undefined}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function TaskKanbanView({ 
  tasks, 
  onTaskClick, 
  onNavigateToLinked,
  kanbanMode 
}: TaskKanbanViewProps) {
  const today = startOfDay(new Date());

  // Fetch workers for display names
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
        const isToday = isSameDay(date, today);
        return (
          <DroppableColumn
            key={dateKey}
            date={date}
            title={getColumnTitle(date, index)}
            tasks={tasksByDate[dateKey] || []}
            onTaskClick={onTaskClick}
            onNavigateToLinked={onNavigateToLinked}
            workersMap={workersMap}
            isToday={isToday}
          />
        );
      })}
    </div>
  );
}
