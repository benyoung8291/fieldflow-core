import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

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
}

export function CapacityPlanningView({ workers, currentDate }: CapacityPlanningViewProps) {
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

  // Fetch service orders that need appointments
  const { data: serviceOrders, isLoading: serviceOrdersLoading } = useQuery({
    queryKey: ["capacity-service-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id, estimated_hours, appointments(start_time, end_time, status)")
        .in("status", ["draft", "scheduled", "in_progress"]);

      if (error) throw error;
      return data as ServiceOrder[];
    },
  });

  const capacityData = useMemo(() => {
    if (!appointments || !serviceOrders) return [];

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
      serviceOrders.forEach(so => {
        const estimatedHours = so.estimated_hours || 0;
        const scheduledHours = (so.appointments || [])
          .filter(apt => apt.status !== 'cancelled')
          .reduce((total, apt) => {
            const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
            return total + hours;
          }, 0);
        
        const remainingHours = Math.max(0, estimatedHours - scheduledHours);
        demandHours += remainingHours;
      });

      weeks.push({
        week: format(weekStart, "MMM d"),
        availableHours: Math.round(totalAvailableHours),
        demandHours: Math.round(demandHours),
        utilization: totalAvailableHours > 0 
          ? Math.round((demandHours / totalAvailableHours) * 100) 
          : 0,
      });
    }

    return weeks;
  }, [appointments, serviceOrders, workers, currentDate]);

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
          <Card key={week.week}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Week of {week.week}</CardTitle>
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
                <span className={`font-medium ${
                  week.utilization > 100 ? 'text-destructive' :
                  week.utilization > 90 ? 'text-warning' :
                  'text-success'
                }`}>
                  {week.utilization}%
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
