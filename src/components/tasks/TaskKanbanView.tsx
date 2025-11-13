import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, addDays, isWeekend, isSameDay, startOfDay, isPast } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DraggableTaskCard from "./DraggableTaskCard";
import { useNavigate } from "react-router-dom";

interface TaskKanbanViewProps {
  tasks: any[];
  onTaskClick: (task: any) => void;
  viewMode?: 'date' | 'status';
}

interface DroppableColumnProps {
  id: string;
  title: string;
  tasks: any[];
  onTaskClick: (task: any) => void;
  workersMap: Record<string, string>;
  isHighlighted?: boolean;
  statusColor?: string;
}

function DroppableColumn({ 
  id,
  title, 
  tasks, 
  onTaskClick, 
  workersMap,
  isHighlighted,
  statusColor
}: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const navigate = useNavigate();

  const getModuleRoute = (module: string, recordId: string) => {
    const routes: Record<string, string> = {
      customer: `/customers/${recordId}`,
      lead: `/leads/${recordId}`,
      project: `/projects/${recordId}`,
      quote: `/quotes/${recordId}`,
      service_order: `/service-orders/${recordId}`,
      appointment: `/appointments/${recordId}`,
      invoice: `/invoices/${recordId}`,
      contract: `/service-contracts/${recordId}`
    };
    return routes[module] || '#';
  };

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
        "flex flex-col min-h-[500px] transition-all duration-200",
        isHighlighted && "ring-2 ring-primary shadow-lg"
      )}
    >
      <CardHeader className={cn(
        "pb-3 transition-colors",
        isHighlighted && "bg-primary/5 border-b border-primary/20",
        statusColor && `border-l-4 ${statusColor}`
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "text-lg font-semibold",
            isHighlighted && "text-primary"
          )}>
            {title}
            {isHighlighted && <span className="ml-2 text-xs font-normal">(Today)</span>}
          </CardTitle>
          <Badge variant={isHighlighted ? "default" : "secondary"} className="shrink-0">
            {tasks.length}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 p-3 overflow-y-auto transition-colors duration-200",
          isOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
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
              onNavigateToLinked={(module, id) => navigate(getModuleRoute(module, id))}
              workerName={workersMap[task.assigned_to]}
              subtaskCount={task.subtaskCount || 0}
              completedSubtaskCount={task.completedSubtaskCount || 0}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function TaskKanbanView({ tasks, onTaskClick, viewMode = 'status' }: TaskKanbanViewProps) {
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const workersMap = useMemo(() => {
    const map: Record<string, string> = {};
    workers.forEach((worker: any) => {
      if (worker.id) {
        map[worker.id] = `${worker.first_name} ${worker.last_name}`;
      }
    });
    return map;
  }, [workers]);

  if (viewMode === 'status') {
    // Status-based kanban view
    const statusColumns = [
      { id: 'pending', title: 'Pending', color: 'border-yellow-500' },
      { id: 'in_progress', title: 'In Progress', color: 'border-blue-500' },
      { id: 'completed', title: 'Completed', color: 'border-green-500' },
      { id: 'cancelled', title: 'Cancelled', color: 'border-gray-500' },
    ];

    const tasksByStatus = useMemo(() => {
      const groups: Record<string, any[]> = {
        'pending': [],
        'in_progress': [],
        'completed': [],
        'cancelled': []
      };
      tasks.forEach((task: any) => {
        if (groups[task.status]) {
          groups[task.status].push(task);
        }
      });
      return groups;
    }, [tasks]);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statusColumns.map((column) => (
          <DroppableColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasksByStatus[column.id]}
            onTaskClick={onTaskClick}
            workersMap={workersMap}
            statusColor={column.color}
          />
        ))}
      </div>
    );
  }

  // Date-based kanban view (original behavior)
  const today = startOfDay(new Date());
  
  const columns = useMemo(() => {
    const cols: { date: Date; title: string; isToday: boolean }[] = [];
    let currentDate = today;
    let daysAdded = 0;
    
    while (daysAdded < 3) {
      if (!isWeekend(currentDate) || tasks.some((t: any) => 
        t.due_date && isSameDay(startOfDay(new Date(t.due_date)), currentDate)
      )) {
        const dayLabel = daysAdded === 0 ? 'Today' : daysAdded === 1 ? 'Tomorrow' : format(currentDate, 'EEEE');
        cols.push({ 
          date: currentDate, 
          title: dayLabel,
          isToday: daysAdded === 0
        });
        daysAdded++;
      }
      currentDate = addDays(currentDate, 1);
    }
    
    return cols;
  }, [today, tasks]);

  const tasksByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    columns.forEach(col => {
      const dateKey = format(col.date, 'yyyy-MM-dd');
      groups[dateKey] = [];
    });

    tasks.forEach((task: any) => {
      if (task.due_date) {
        const taskDate = startOfDay(new Date(task.due_date));
        const dateKey = format(taskDate, 'yyyy-MM-dd');
        if (groups[dateKey]) {
          groups[dateKey].push(task);
        }
      }
    });

    return groups;
  }, [tasks, columns]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {columns.map((column) => (
        <DroppableColumn
          key={format(column.date, 'yyyy-MM-dd')}
          id={format(column.date, 'yyyy-MM-dd')}
          title={`${column.title} - ${format(column.date, 'MMM d')}`}
          tasks={tasksByDate[format(column.date, 'yyyy-MM-dd')]}
          onTaskClick={onTaskClick}
          workersMap={workersMap}
          isHighlighted={column.isToday}
        />
      ))}
    </div>
  );
}
