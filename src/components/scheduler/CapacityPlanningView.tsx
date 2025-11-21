import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useDroppable, useDndMonitor } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, Package } from "lucide-react";

interface Worker {
  id: string;
  full_name: string;
  standard_work_hours?: number;
  employment_type?: string;
}

interface Appointment {
  start_time: string;
  end_time: string;
  status: string;
  appointment_workers?: Array<{ worker_id: string }>;
}

interface ServiceOrder {
  estimated_hours?: number;
  appointments?: Array<{ start_time: string; end_time: string; status: string }>;
}

interface CapacityPlanningViewProps {
  workers: Worker[];
  currentDate: Date;
  onScheduleServiceOrder: (serviceOrderId: string, weekStart: Date, weekEnd: Date) => void;
  successWeek?: Date | null;
}

interface DroppableWeekCardProps {
  week: {
    week: string;
    weekStart: Date;
    availableHours: number;
    demandHours: number;
    utilization: number;
  };
  onDrop: () => void;
  activeServiceOrder?: any;
  isSuccess?: boolean;
}

function DroppableWeekCard({ week, onDrop, activeServiceOrder, isSuccess }: DroppableWeekCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `capacity-week-${week.weekStart.toISOString()}`,
    data: { 
      type: 'capacity-week',
      weekStart: week.weekStart,
      weekEnd: endOfWeek(week.weekStart)
    }
  });

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "transition-all cursor-pointer hover:shadow-lg",
        isOver && "ring-2 ring-primary bg-primary/5",
        isSuccess && "animate-scale-in ring-2 ring-success bg-success/10"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Week of {week.week}
          {isOver && <Badge variant="outline" className="ml-2">Drop Here</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Available:</span>
          <span className="font-medium text-success">{week.availableHours}h</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Demand:</span>
          <span className="font-medium text-primary">{week.demandHours}h</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Utilization:</span>
          <span className={cn(
            "font-medium",
            week.utilization > 100 ? 'text-destructive' :
            week.utilization > 90 ? 'text-warning' :
            'text-success'
          )}>
            {week.utilization}%
          </span>
        </div>
        
        {isOver && activeServiceOrder && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
              <Package className="h-3 w-3" />
              Preview: Scheduling
            </div>
            <div className="bg-primary/10 rounded-md p-2 space-y-1">
              <div className="text-xs font-medium truncate">
                {activeServiceOrder.order_number}
              </div>
              <div className="text-[10px] text-muted-foreground line-clamp-2">
                {activeServiceOrder.title}
              </div>
              {activeServiceOrder.estimated_hours && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {activeServiceOrder.estimated_hours}h estimated
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CapacityPlanningView({ workers, currentDate, onScheduleServiceOrder, successWeek }: CapacityPlanningViewProps) {
  const numberOfWeeks = 6;
  const [activeServiceOrder, setActiveServiceOrder] = useState<any>(null);

  useDndMonitor({
    onDragStart: (event) => {
      if (event.active.data.current?.type === 'service-order') {
        setActiveServiceOrder(event.active.data.current.serviceOrder);
      }
    },
    onDragEnd: () => {
      setActiveServiceOrder(null);
    },
    onDragCancel: () => {
      setActiveServiceOrder(null);
    },
  });

  // Fetch appointments for the next N weeks
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["capacity-appointments", currentDate],
    queryFn: async () => {
      const startDate = startOfWeek(currentDate);
      const endDate = endOfWeek(addWeeks(currentDate, numberOfWeeks));

      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status, appointment_workers(worker_id)")
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString())
        .neq("status", "cancelled");

      if (error) throw error;
      return data as Appointment[];
    },
  });

  // Fetch service orders that need appointments with full details
  const { data: serviceOrdersData, isLoading: serviceOrdersLoading } = useQuery({
    queryKey: ["capacity-service-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          id, 
          order_number,
          title,
          estimated_hours, 
          preferred_date,
          preferred_date_start,
          preferred_date_end,
          appointments(id, start_time, end_time, status),
          customers!service_orders_customer_id_fkey(name),
          service_order_line_items(id)
        `)
        .in("status", ["draft", "scheduled", "in_progress"]);

      if (error) throw error;
      return data;
    },
  });

  const capacityData = useMemo(() => {
    if (!appointments || !serviceOrdersData) return [];

    // First, calculate remaining hours for each service order
    const serviceOrdersWithRemaining = serviceOrdersData.map(so => {
      const estimatedHours = so.estimated_hours || 0;
      const scheduledHours = (so.appointments || [])
        .filter((apt: any) => apt.status !== 'cancelled')
        .reduce((total: number, apt: any) => {
          const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
          return total + hours;
        }, 0);
      
      const remainingHours = Math.max(0, estimatedHours - scheduledHours);
      
      return {
        ...so,
        remainingHours
      };
    }).filter(so => so.remainingHours > 0);

    const weeks = [];
    
    for (let i = 0; i < numberOfWeeks; i++) {
      const weekStart = startOfWeek(addWeeks(currentDate, i));
      const weekEnd = endOfWeek(addWeeks(currentDate, i));

      // Calculate total available hours for this week
      let totalAvailableHours = 0;
      workers.forEach(worker => {
        const standardHours = worker.standard_work_hours || 
          (worker.employment_type === 'full_time' ? 40 : 0);
        
        // Subtract already scheduled hours
        const scheduledHours = appointments
          .filter(apt => {
            const aptStart = new Date(apt.start_time);
            if (aptStart < weekStart || aptStart > weekEnd) return false;
            if (apt.status === 'cancelled') return false;
            
            const isAssigned = apt.appointment_workers?.some(aw => aw.worker_id === worker.id);
            
            return isAssigned;
          })
          .reduce((total, apt) => {
            const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
            return total + hours;
          }, 0);

        totalAvailableHours += Math.max(0, standardHours - scheduledHours);
      });

      // Calculate weighted demand for this specific week
      let demandHours = 0;
      serviceOrdersWithRemaining.forEach(so => {
        const preferredDate = so.preferred_date ? new Date(so.preferred_date) : null;
        const dateRangeStart = so.preferred_date_start ? new Date(so.preferred_date_start) : null;
        const dateRangeEnd = so.preferred_date_end ? new Date(so.preferred_date_end) : null;
        
        // If we have a date range, use it
        if (dateRangeStart && dateRangeEnd) {
          // Check if this week overlaps with the date range
          if (weekEnd >= dateRangeStart && weekStart <= dateRangeEnd) {
            // Calculate overlap days
            const overlapStart = weekStart > dateRangeStart ? weekStart : dateRangeStart;
            const overlapEnd = weekEnd < dateRangeEnd ? weekEnd : dateRangeEnd;
            const overlapDays = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1);
            
            // Calculate total days in the range
            const totalRangeDays = (dateRangeEnd.getTime() - dateRangeStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
            
            // Weight the demand proportionally based on overlap
            const weight = overlapDays / totalRangeDays;
            demandHours += so.remainingHours * weight;
          }
        } else if (preferredDate) {
          // If only preferred date (no range), distribute across a default 7-day window
          const rangeStart = new Date(preferredDate);
          rangeStart.setDate(rangeStart.getDate() - 3); // 3 days before
          const rangeEnd = new Date(preferredDate);
          rangeEnd.setDate(rangeEnd.getDate() + 3); // 3 days after
          
          if (weekEnd >= rangeStart && weekStart <= rangeEnd) {
            const overlapStart = weekStart > rangeStart ? weekStart : rangeStart;
            const overlapEnd = weekEnd < rangeEnd ? weekEnd : rangeEnd;
            const overlapDays = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1);
            const totalRangeDays = 7;
            const weight = overlapDays / totalRangeDays;
            demandHours += so.remainingHours * weight;
          }
        } else {
          // No preferred date or range: distribute evenly across all weeks
          demandHours += so.remainingHours / numberOfWeeks;
        }
      });

      weeks.push({
        week: format(weekStart, "MMM d"),
        weekStart: weekStart,
        availableHours: Math.round(totalAvailableHours),
        demandHours: Math.round(demandHours),
        utilization: totalAvailableHours > 0 
          ? Math.round((demandHours / totalAvailableHours) * 100) 
          : 0,
      });
    }

    return weeks;
  }, [appointments, serviceOrdersData, workers, currentDate]);

  if (appointmentsLoading || serviceOrdersLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Capacity Planning</CardTitle>
          <CardDescription>
            Available worker hours vs service order demand for the next {numberOfWeeks} weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              availableHours: {
                label: "Available Hours",
                color: "hsl(var(--success))",
              },
              demandHours: {
                label: "Demand Hours",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[400px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capacityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="week" 
                  className="text-xs fill-muted-foreground"
                />
                <YAxis 
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  className="text-xs fill-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar 
                  dataKey="availableHours" 
                  fill="hsl(var(--success))" 
                  name="Available Hours"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="demandHours" 
                  fill="hsl(var(--primary))" 
                  name="Demand Hours"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {capacityData.map((week) => (
          <DroppableWeekCard 
            key={week.week}
            week={week}
            onDrop={() => {}}
            activeServiceOrder={activeServiceOrder}
            isSuccess={successWeek?.toISOString() === week.weekStart.toISOString()}
          />
        ))}
      </div>
    </div>
  );
}
