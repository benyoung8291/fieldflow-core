import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";

interface GanttTask {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  progress?: number;
}

interface ProjectGanttChartProps {
  tasks: GanttTask[];
  projectStart?: string;
  projectEnd?: string;
}

export default function ProjectGanttChart({ tasks, projectStart, projectEnd }: ProjectGanttChartProps) {
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

      return {
        ...task,
        left: (startOffset / totalDays) * 100,
        width: (duration / totalDays) * 100,
      };
    });

    return { chartStart, chartEnd, dayColumns: days, taskBars };
  }, [tasks, projectStart, projectEnd]);

  const statusColors: Record<string, string> = {
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
      <CardHeader>
        <CardTitle>Project Timeline</CardTitle>
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
            {taskBars.map((task) => (
              <div key={task.id} className="flex items-center border-b hover:bg-muted/30">
                <div className="w-64 flex-shrink-0 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{task.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="flex-1 relative h-12">
                  <div
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 h-8 rounded-md flex items-center px-2",
                      statusColors[task.status] || "bg-gray-500"
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
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}