import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDroppable } from "@dnd-kit/core";
import { Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import DraggableServiceOrder from "./DraggableServiceOrder";

interface Worker {
  id: string;
  full_name: string;
  standard_work_hours?: number;
  employment_type?: string;
}

interface Appointment {
  start_time: string;
  end_time: string;
  assigned_to: string | null;
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
}

function DroppableWeekCard({ week, onDrop }: DroppableWeekCardProps) {
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
        isOver && "ring-2 ring-primary bg-primary/5"
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
      </CardContent>
    </Card>
  );
}

export function CapacityPlanningView({ workers, currentDate, onScheduleServiceOrder }: CapacityPlanningViewProps) {
  const numberOfWeeks = 6;

  // Fetch appointments for the next N weeks
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["capacity-appointments", currentDate],
    queryFn: async () => {
      const startDate = startOfWeek(currentDate);
      const endDate = endOfWeek(addWeeks(currentDate, numberOfWeeks));

      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, assigned_to, status, appointment_workers(worker_id)")
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
          appointments(id, start_time, end_time, status),
          customers!service_orders_customer_id_fkey(name),
          service_order_line_items(id)
        `)
        .in("status", ["draft", "scheduled", "in_progress"]);

      if (error) throw error;
      return data;
    },
  });

  // Filter service orders that need appointments
  const serviceOrdersNeedingAppointments = useMemo(() => {
    if (!serviceOrdersData) return [];
    
    return serviceOrdersData.map(so => {
      const scheduledHours = (so.appointments || [])
        .filter(apt => apt.status !== 'cancelled')
        .reduce((total, apt) => {
          const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
          return total + hours;
        }, 0);
      
      const lineItemsCount = so.service_order_line_items?.length || 0;
      const remainingHours = Math.max(0, (so.estimated_hours || 0) - scheduledHours);
      
      return {
        ...so,
        scheduledHours,
        remainingHours,
        lineItemsSummary: `${lineItemsCount} item${lineItemsCount !== 1 ? 's' : ''}`
      };
    }).filter(so => so.remainingHours > 0);
  }, [serviceOrdersData]);

  const capacityData = useMemo(() => {
    if (!appointments || !serviceOrdersData) return [];

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
            
            const isPrimary = apt.assigned_to === worker.id;
            const isAssigned = apt.appointment_workers?.some(aw => aw.worker_id === worker.id);
            
            return isPrimary || isAssigned;
          })
          .reduce((total, apt) => {
            const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
            return total + hours;
          }, 0);

        totalAvailableHours += Math.max(0, standardHours - scheduledHours);
      });

      // Calculate service order demand (estimated hours minus scheduled hours)
      let demandHours = 0;
      serviceOrdersData.forEach(so => {
        const estimatedHours = so.estimated_hours || 0;
        const scheduledHours = (so.appointments || [])
          .filter((apt: any) => apt.status !== 'cancelled')
          .reduce((total: number, apt: any) => {
            const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
            return total + hours;
          }, 0);
        
        const remainingHours = Math.max(0, estimatedHours - scheduledHours);
        demandHours += remainingHours;
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
    <div className="grid grid-cols-[300px_1fr] gap-4 h-full overflow-hidden">
      {/* Left Sidebar - Service Orders */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="text-sm">Service Orders Needing Appointments</CardTitle>
          <CardDescription className="text-xs">
            Drag to schedule in available weeks
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            <div className="space-y-2">
              {serviceOrdersNeedingAppointments.map((order) => (
                <DraggableServiceOrder 
                  key={order.id}
                  serviceOrder={{
                    id: order.id,
                    order_number: order.order_number,
                    title: order.title,
                    customers: order.customers,
                    estimated_hours: order.estimated_hours,
                    scheduledHours: order.scheduledHours,
                    remainingHours: order.remainingHours,
                    lineItemsSummary: order.lineItemsSummary
                  }}
                  remainingHours={order.remainingHours}
                />
              ))}
              {serviceOrdersNeedingAppointments.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No service orders need appointments
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Content - Capacity Charts and Week Cards */}
      <div className="space-y-6 overflow-auto p-6">
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
