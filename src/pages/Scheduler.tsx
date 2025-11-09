import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths, setHours, setMinutes, addHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import SchedulerDayView from "@/components/scheduler/SchedulerDayView";
import SchedulerWeekView from "@/components/scheduler/SchedulerWeekView";
import SchedulerMonthView from "@/components/scheduler/SchedulerMonthView";
import KanbanBoardView from "@/components/scheduler/KanbanBoardView";
import AppointmentDialog from "@/components/scheduler/AppointmentDialog";
import AuditDrawer from "@/components/audit/AuditDrawer";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import ServiceOrdersSidebar from "@/components/scheduler/ServiceOrdersSidebar";
import { useAppointmentConflicts } from "@/hooks/useAppointmentConflicts";
import { toast } from "sonner";

export default function Scheduler() {
  const [viewType, setViewType] = useState<"day" | "week" | "month" | "kanban">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  const { onlineUsers, updateCursorPosition } = usePresence({ page: "scheduler" });
  const { checkConflict, checkAvailability } = useAppointmentConflicts();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [updateCursorPosition]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service_orders(order_number, title),
          profiles!appointments_assigned_to_fkey(first_name, last_name)
        `)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const todayAppointments = appointments.filter(apt => 
    isSameDay(new Date(apt.start_time), new Date())
  );
  
  const checkedInAppointments = appointments.filter(apt => 
    apt.status === "checked_in"
  );
  
  const uniqueTechnicians = new Set(appointments.map(apt => apt.assigned_to).filter(Boolean));
  const activeWorkers = uniqueTechnicians.size;

  const handlePrevious = () => {
    if (viewType === "day") {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewType === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewType === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewType === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeLabel = () => {
    if (viewType === "day") {
      return format(currentDate, "EEEE, MMMM d, yyyy");
    } else if (viewType === "week") {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    } else {
      return format(currentDate, "MMMM yyyy");
    }
  };

  const handleCreateAppointment = () => {
    setEditingAppointmentId(undefined);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) {
      setEditingAppointmentId(undefined);
    }
  }, [dialogOpen]);

  const createAppointmentMutation = useMutation({
    mutationFn: async ({ 
      serviceOrderId, 
      startTime, 
      endTime, 
      workerId 
    }: { 
      serviceOrderId: string; 
      startTime: Date; 
      endTime: Date; 
      workerId: string | null;
    }) => {
      const { data: serviceOrder } = await supabase
        .from("service_orders")
        .select("title, description, customer_id")
        .eq("id", serviceOrderId)
        .single();

      const { data: customer } = await supabase
        .from("customers")
        .select("address")
        .eq("id", serviceOrder?.customer_id)
        .single();

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { error } = await supabase.from("appointments").insert({
        tenant_id: profile?.tenant_id,
        service_order_id: serviceOrderId,
        title: serviceOrder?.title || "New Appointment",
        description: serviceOrder?.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        assigned_to: workerId,
        location_address: customer?.address,
        status: "published",
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["service-orders-with-appointments"] });
      toast.success("Appointment created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create appointment");
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ 
      appointmentId, 
      startTime, 
      endTime, 
      workerId 
    }: { 
      appointmentId: string; 
      startTime: Date; 
      endTime: Date; 
      workerId: string | null;
    }) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          assigned_to: workerId,
        })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update appointment");
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedItem = active.data.current;
    const dropTarget = over.data.current;

    if (dropTarget?.type !== "time-slot") return;

    const { date, workerId, hour } = dropTarget;

    // Calculate start and end times
    const startTime = hour !== undefined 
      ? setMinutes(setHours(date, hour), 0)
      : setHours(date, 9); // Default to 9 AM if no hour specified

    const endTime = addHours(startTime, 2); // Default 2 hour appointment

    // Handle dropping a service order
    if (draggedItem?.type === "service-order") {
      const serviceOrder = draggedItem.serviceOrder;

      // Check conflicts and availability
      if (workerId) {
        const conflict = checkConflict(workerId, startTime, endTime);
        if (conflict.hasConflict) {
          toast.error(conflict.reason);
          return;
        }

        const availability = checkAvailability(workerId, startTime, endTime);
        if (!availability.isAvailable) {
          toast.warning(availability.reason || "Worker may not be available");
        }
      }

      createAppointmentMutation.mutate({
        serviceOrderId: serviceOrder.id,
        startTime,
        endTime,
        workerId,
      });
    }

    // Handle moving an existing appointment
    if (draggedItem?.type === "appointment") {
      const appointment = draggedItem.appointment;

      // Calculate duration
      const originalStart = new Date(appointment.start_time);
      const originalEnd = new Date(appointment.end_time);
      const durationMs = originalEnd.getTime() - originalStart.getTime();
      const newEndTime = new Date(startTime.getTime() + durationMs);

      // Check conflicts and availability
      if (workerId) {
        const conflict = checkConflict(workerId, startTime, newEndTime, appointment.id);
        if (conflict.hasConflict) {
          toast.error(conflict.reason);
          return;
        }

        const availability = checkAvailability(workerId, startTime, newEndTime);
        if (!availability.isAvailable) {
          toast.warning(availability.reason || "Worker may not be available");
        }
      }

      updateAppointmentMutation.mutate({
        appointmentId: appointment.id,
        startTime,
        endTime: newEndTime,
        workerId,
      });
    }
  };

  return (
    <DashboardLayout>
      <RemoteCursors users={onlineUsers} />
      
      {selectedAppointment && (
        <AuditDrawer 
          tableName="appointments" 
          recordId={selectedAppointment}
          recordTitle={`Appointment ${appointments.find((a: any) => a.id === selectedAppointment)?.title}`}
        />
      )}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointmentId={editingAppointmentId}
        defaultDate={currentDate}
      />

      <DndContext onDragEnd={handleDragEnd} onDragStart={(e) => setActiveId(e.active.id as string)}>
        <div className="grid grid-cols-[1fr_350px] gap-6">
          <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Scheduler</h1>
            <p className="text-muted-foreground mt-2">
              Manage appointments with GPS check-in/out
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PresenceIndicator users={onlineUsers} />
            <Button className="gap-2" onClick={handleCreateAppointment}>
              <Clock className="h-4 w-4" />
              New Appointment
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayAppointments.length}</div>
              <p className="text-xs text-muted-foreground">
                {todayAppointments.filter(a => !a.assigned_to).length} pending assignments
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Users className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeWorkers}</div>
              <p className="text-xs text-muted-foreground">
                {appointments.filter(a => a.status === "draft" || a.status === "published").length} scheduled
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <MapPin className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{checkedInAppointments.length}</div>
              <p className="text-xs text-muted-foreground">
                {appointments.filter(a => a.status === "completed").length} completed today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Controls */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold">{getDateRangeLabel()}</h3>
                </div>
              </div>
              <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)}>
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="kanban">Kanban</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading appointments...</div>
            ) : (
              <>
                {viewType === "day" && (
                  <SchedulerDayView 
                    currentDate={currentDate} 
                    appointments={appointments}
                    onAppointmentClick={(id) => setSelectedAppointment(id)}
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                  />
                )}
                {viewType === "week" && (
                  <SchedulerWeekView 
                    currentDate={currentDate}
                    appointments={appointments}
                    onAppointmentClick={(id) => setSelectedAppointment(id)}
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                  />
                )}
                {viewType === "month" && (
                  <SchedulerMonthView 
                    currentDate={currentDate}
                    appointments={appointments}
                    onAppointmentClick={(id) => setSelectedAppointment(id)}
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                  />
                )}
                {viewType === "kanban" && (
                  <KanbanBoardView
                    appointments={appointments}
                    onAppointmentClick={(id) => setSelectedAppointment(id)}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-sm">Status Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted"></div>
                <span className="text-sm">Draft</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-info"></div>
                <span className="text-sm">Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-warning"></div>
                <span className="text-sm">Checked In</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success"></div>
                <span className="text-sm">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive"></div>
                <span className="text-sm">Cancelled</span>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>

          {/* Draggable Service Orders Sidebar */}
          <div>
            <ServiceOrdersSidebar />
          </div>
        </div>
      </DndContext>
    </DashboardLayout>
  );
}
