import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { useCriticalPath } from "@/hooks/useCriticalPath";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap } from "lucide-react";

interface GanttTask {
  id: string;
  name?: string; // Gantt chart uses 'name'
  title?: string; // Project tasks use 'title'
  start_date: string;
  end_date: string;
  status: string;
  progress?: number;
  progress_percentage?: number; // Project tasks use this name
}

interface Dependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  lag_days: number;
}

interface ProjectGanttChartProps {
  tasks: GanttTask[];
  dependencies?: Dependency[];
  projectStart?: string;
  projectEnd?: string;
}

export default function ProjectGanttChart({ tasks, dependencies = [], projectStart, projectEnd }: ProjectGanttChartProps) {
  // Normalize tasks to ensure they have required fields
  const normalizedTasks = tasks.map(t => ({
    ...t,
    name: t.name || t.title || 'Untitled',
  }));
  
  const { criticalTaskIds, taskSlack, criticalPathDuration } = useCriticalPath(normalizedTasks as any, dependencies);
  const { chartStart, chartEnd, dayColumns, taskBars } = useMemo(() => {
    if (!tasks.length) {
      return { chartStart: new Date(), chartEnd: new Date(), dayColumns: [], taskBars: [] };
    }

    // Determine chart date range
    const allDates = tasks.flatMap(t => [new Date(t.start_date), new Date(t.end_date)]);
    if (projectStart) allDates.push(new Date(projectStart));
    if (projectEnd) allDates.push(new Date(projectEnd));

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

    const chartStart = startOfWeek(minDate, { weekStartsOn: 1 });
    const chartEnd = endOfWeek(maxDate, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: chartStart, end: chartEnd });
    const totalDays = days.length;

    // Calculate task bar positions
    const taskBars = tasks.map(task => {
      const taskStart = new Date(task.start_date);
      const taskEnd = new Date(task.end_date);
      const startOffset = differenceInDays(taskStart, chartStart);
      const duration = differenceInDays(taskEnd, taskStart) + 1;

      // Handle both name (Gantt) and title (project tasks) fields
      const taskName = task.name || task.title || 'Untitled Task';
      const taskProgress = task.progress ?? task.progress_percentage ?? 0;

      return {
        ...task,
        name: taskName,
        progress: taskProgress,
        left: (startOffset / totalDays) * 100,
        width: (duration / totalDays) * 100,
      };
    });

    return { chartStart, chartEnd, dayColumns: days, taskBars };
  }, [tasks, projectStart, projectEnd]);

  const statusColors: Record<string, string> = {
    'pending': 'bg-gray-500',
    'not_started': 'bg-gray-500',
    'in_progress': 'bg-blue-500',
    'completed': 'bg-green-500',
    'on_hold': 'bg-yellow-500',
    'cancelled': 'bg-red-500',
  };

  if (!tasks.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No tasks to display in Gantt chart</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Project Timeline</CardTitle>
        {criticalTaskIds.size > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-destructive" />
                  <span className="text-muted-foreground">
                    Critical Path: <span className="font-semibold text-foreground">{criticalPathDuration} days</span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tasks that cannot be delayed without affecting project completion</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Timeline header */}
          <div className="flex border-b">
            <div className="w-64 flex-shrink-0 px-4 py-2 font-medium text-sm">Task</div>
            <div className="flex-1 flex">
              {dayColumns.map((day, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex-1 border-l px-1 py-2 text-center text-xs",
                    day.getDay() === 0 || day.getDay() === 6 ? "bg-muted/30" : ""
                  )}
                >
                  <div>{format(day, "EEE")}</div>
                  <div className="font-medium">{format(day, "d")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Task rows */}
          <div className="space-y-1">
            {taskBars.map((task) => {
              const isCritical = criticalTaskIds.has(task.id);
              const slack = taskSlack.get(task.id) || 0;
              
              return (
                <TooltipProvider key={task.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center border-b hover:bg-muted/30 transition-colors",
                        isCritical && "bg-destructive/5"
                      )}>
                        <div className="w-64 flex-shrink-0 px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isCritical && (
                              <Zap className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                            )}
                            <span className={cn(
                              "text-sm font-medium truncate",
                              isCritical && "text-destructive"
                            )}>
                              {task.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex-1 relative h-12">
                          <div
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 h-8 rounded-md flex items-center px-2 transition-all",
                              statusColors[task.status] || "bg-gray-500",
                              isCritical && "ring-2 ring-destructive ring-offset-1 ring-offset-background shadow-lg"
                            )}
                            style={{
                              left: `${task.left}%`,
                              width: `${task.width}%`,
                            }}
                          >
                            {task.progress !== undefined && (
                              <div className="text-xs text-white font-medium truncate">
                                {task.progress}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      {isCritical ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-destructive flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Critical Path Task
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This task cannot be delayed without affecting the project end date
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold">Float: {slack} days</p>
                          <p className="text-xs text-muted-foreground">
                            This task can be delayed by up to {slack} days without affecting the project
                          </p>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}