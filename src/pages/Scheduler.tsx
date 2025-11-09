import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users, FileText, List } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths, setHours, setMinutes, addHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import SchedulerDayView from "@/components/scheduler/SchedulerDayView";
import SchedulerWeekView from "@/components/scheduler/SchedulerWeekView";
import SchedulerMonthView from "@/components/scheduler/SchedulerMonthView";
import KanbanBoardView from "@/components/scheduler/KanbanBoardView";
import ServiceOrdersCalendarView from "@/components/scheduler/ServiceOrdersCalendarView";
import BryntumSchedulerPlaceholder from "@/components/scheduler/BryntumSchedulerPlaceholder";
import AppointmentDialog from "@/components/scheduler/AppointmentDialog";
import TemplatesDialog from "@/components/scheduler/TemplatesDialog";
import AppointmentDetailsDialog from "@/components/scheduler/AppointmentDetailsDialog";
import GPSCheckInDialog from "@/components/scheduler/GPSCheckInDialog";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Scheduler() {
  const [viewType, setViewType] = useState<"day" | "week" | "month" | "kanban" | "bryntum">("week");
  const [showServiceOrderView, setShowServiceOrderView] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [detailsAppointment, setDetailsAppointment] = useState<any | null>(null);
  const [gpsCheckInAppointment, setGpsCheckInAppointment] = useState<any | null>(null);
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
          profiles!appointments_assigned_to_fkey(first_name, last_name),
          appointment_workers(worker_id, profiles(first_name, last_name))
        `)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch all active workers/profiles
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (error) throw error;
      return data || [];
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

  const handleUseAppointmentTemplate = (template: any) => {
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(9, 0, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + template.duration_hours);

    setEditingAppointmentId(undefined);
    setDialogOpen(true);
    
    // The dialog will handle pre-filling from template data
    setTimeout(() => {
      // You could pass template data to the dialog via a ref or context
    }, 100);
  };

  const handleUseServiceOrderTemplate = (template: any) => {
    // Navigate to service orders page with template data
    toast.success("Service order template selected");
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

      const { data: newAppointment, error } = await supabase.from("appointments").insert({
        tenant_id: profile?.tenant_id,
        service_order_id: serviceOrderId,
        title: serviceOrder?.title || "New Appointment",
        description: serviceOrder?.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        assigned_to: workerId,
        location_address: customer?.address,
        status: "draft",
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }).select(`
        *,
        service_orders(order_number, title),
        profiles!appointments_assigned_to_fkey(first_name, last_name),
        appointment_workers(worker_id, profiles(first_name, last_name))
      `).single();

      if (error) throw error;

      // Add to appointment_workers junction table
      if (workerId && newAppointment) {
        await supabase.from("appointment_workers").insert({
          tenant_id: profile?.tenant_id,
          appointment_id: newAppointment.id,
          worker_id: workerId,
        });
      }

      return newAppointment;
    },
    onMutate: async ({ serviceOrderId, startTime, endTime, workerId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["appointments"] });

      // Snapshot previous value
      const previousAppointments = queryClient.getQueryData(["appointments"]);

      // Optimistically update with placeholder
      queryClient.setQueryData(["appointments"], (old: any) => {
        const optimisticAppointment = {
          id: `temp-${Date.now()}`,
          service_order_id: serviceOrderId,
          title: "Creating appointment...",
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          assigned_to: workerId,
          status: "draft",
          service_orders: null,
          profiles: null,
        };
        return [...(old || []), optimisticAppointment];
      });

      return { previousAppointments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["service-orders-with-appointments"] });
      toast.success("Appointment created successfully");
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousAppointments) {
        queryClient.setQueryData(["appointments"], context.previousAppointments);
      }
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
      // Update appointment times and primary worker
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          assigned_to: workerId,
        })
        .eq("id", appointmentId);

      if (updateError) throw updateError;

      if (workerId) {
        // Get tenant_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", (await supabase.auth.getUser()).data.user?.id)
          .single();

        // Clear existing workers and add new one
        await supabase
          .from("appointment_workers")
          .delete()
          .eq("appointment_id", appointmentId);

        const { error: workerError } = await supabase
          .from("appointment_workers")
          .insert({
            tenant_id: profile?.tenant_id,
            appointment_id: appointmentId,
            worker_id: workerId,
          });

        if (workerError) throw workerError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment reassigned successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update appointment");
    },
  });

  const addWorkerToAppointmentMutation = useMutation({
    mutationFn: async ({ 
      appointmentId, 
      workerId 
    }: { 
      appointmentId: string; 
      workerId: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { error } = await supabase
        .from("appointment_workers")
        .insert({
          tenant_id: profile?.tenant_id,
          appointment_id: appointmentId,
          worker_id: workerId,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error("Worker already assigned to this appointment");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Worker added to appointment");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add worker");
    },
  });

  const removeWorkerFromAppointmentMutation = useMutation({
    mutationFn: async ({ 
      appointmentId, 
      workerId 
    }: { 
      appointmentId: string; 
      workerId: string;
    }) => {
      const { error } = await supabase
        .from("appointment_workers")
        .delete()
        .eq("appointment_id", appointmentId)
        .eq("worker_id", workerId);

      if (error) throw error;

      // Check if there are any workers left
      const { data: remainingWorkers } = await supabase
        .from("appointment_workers")
        .select("id")
        .eq("appointment_id", appointmentId);

      // If no workers left, set assigned_to to null
      if (!remainingWorkers || remainingWorkers.length === 0) {
        await supabase
          .from("appointments")
          .update({ assigned_to: null })
          .eq("id", appointmentId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Worker removed from appointment");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove worker");
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment deleted");
      setDetailsAppointment(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete appointment");
    },
  });

  const publishAppointmentsMutation = useMutation({
    mutationFn: async (appointmentIds: string[]) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "published" })
        .in("id", appointmentIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointments published successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to publish appointments");
    },
  });

  const handleRemoveWorker = (appointmentId: string, workerId: string) => {
    removeWorkerFromAppointmentMutation.mutate({ appointmentId, workerId });
  };

  const handleDeleteAppointment = (appointmentId: string) => {
    if (confirm("Are you sure you want to delete this appointment?")) {
      deleteAppointmentMutation.mutate(appointmentId);
    }
  };

  const handlePublishAllDraft = () => {
    const draftAppointments = appointments.filter(apt => apt.status === "draft");
    if (draftAppointments.length === 0) {
      toast.info("No draft appointments to publish");
      return;
    }
    if (confirm(`Publish ${draftAppointments.length} draft appointment(s)?`)) {
      publishAppointmentsMutation.mutate(draftAppointments.map(apt => apt.id));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedItem = active.data.current;
    const dropTarget = over.data.current;

    if (dropTarget?.type !== "time-slot") return;

    const { date, workerId, hour } = dropTarget;
    const isMultiAssign = event.activatorEvent instanceof KeyboardEvent 
      ? event.activatorEvent.ctrlKey || event.activatorEvent.metaKey
      : (event.activatorEvent as MouseEvent)?.ctrlKey || (event.activatorEvent as MouseEvent)?.metaKey;

    // Calculate start and end times
    const startTime = hour !== undefined 
      ? setMinutes(setHours(date, hour), 0)
      : setHours(date, 18); // Default to 6 PM if no hour specified

    // For service orders, use 4 hour default, otherwise 2 hours
    const defaultDuration = draggedItem?.type === "service-order" ? 4 : 2;
    const endTime = addHours(startTime, defaultDuration);

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

      if (isMultiAssign && workerId) {
        // Add worker to appointment (multi-assign)
        addWorkerToAppointmentMutation.mutate({
          appointmentId: appointment.id,
          workerId,
        });
      } else {
        // Move appointment (reassign)
        updateAppointmentMutation.mutate({
          appointmentId: appointment.id,
          startTime,
          endTime: newEndTime,
          workerId,
        });
      }
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

      <TemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        onUseAppointmentTemplate={handleUseAppointmentTemplate}
        onUseServiceOrderTemplate={handleUseServiceOrderTemplate}
      />

      <AppointmentDetailsDialog
        appointment={detailsAppointment}
        open={!!detailsAppointment}
        onOpenChange={(open) => !open && setDetailsAppointment(null)}
        onEdit={() => {
          setEditingAppointmentId(detailsAppointment?.id);
          setDialogOpen(true);
          setDetailsAppointment(null);
        }}
        onDelete={detailsAppointment && !detailsAppointment.assigned_to ? () => handleDeleteAppointment(detailsAppointment.id) : undefined}
      />

      {gpsCheckInAppointment && (
        <GPSCheckInDialog
          appointment={gpsCheckInAppointment}
          open={!!gpsCheckInAppointment}
          onOpenChange={(open) => !open && setGpsCheckInAppointment(null)}
        />
      )}

      <DndContext onDragEnd={handleDragEnd} onDragStart={(e) => setActiveId(e.active.id as string)}>
        <div className="grid grid-cols-[1fr_350px] gap-6">
          <div className="space-y-4">
        {/* Compact Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Today's Jobs</p>
                </div>
                <p className="text-lg font-bold">{todayAppointments.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Active Workers</p>
                </div>
                <p className="text-lg font-bold">{activeWorkers}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Checked In</p>
                </div>
                <p className="text-lg font-bold">{checkedInAppointments.length}</p>
              </div>
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
              <div className="flex items-center gap-4">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handlePublishAllDraft}
                  disabled={!appointments.some(apt => apt.status === "draft")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Publish Draft Appointments
                </Button>
                <div className="flex items-center gap-2">
                  <Switch 
                    id="service-order-view" 
                    checked={showServiceOrderView}
                    onCheckedChange={setShowServiceOrderView}
                  />
                  <Label htmlFor="service-order-view" className="text-sm cursor-pointer">
                    <List className="h-4 w-4 inline mr-1" />
                    Service Order View
                  </Label>
                </div>
                <Tabs value={viewType} onValueChange={(v) => setViewType(v as "day" | "week" | "month" | "kanban" | "bryntum")}>
                  <TabsList>
                    <TabsTrigger value="day">Day</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="kanban">Kanban</TabsTrigger>
                    <TabsTrigger value="bryntum">Bryntum</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading appointments...</div>
            ) : showServiceOrderView ? (
              <ServiceOrdersCalendarView 
                currentDate={currentDate}
                appointments={appointments}
                viewType={viewType}
                onAppointmentClick={(id) => setSelectedAppointment(id)}
              />
            ) : (
              <>
                {viewType === "day" && (
                  <SchedulerDayView 
                    currentDate={currentDate} 
                    appointments={appointments}
                    onAppointmentClick={(id) => {
                      const apt = appointments.find(a => a.id === id);
                      setDetailsAppointment(apt);
                    }}
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                    onRemoveWorker={handleRemoveWorker}
                    onGPSCheckIn={(apt) => setGpsCheckInAppointment(apt)}
                  />
                )}
                {viewType === "week" && (
                  <SchedulerWeekView 
                    currentDate={currentDate}
                    appointments={appointments}
                    workers={workers}
                    onAppointmentClick={(id) => {
                      const apt = appointments.find(a => a.id === id);
                      setDetailsAppointment(apt);
                    }}
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                    onRemoveWorker={handleRemoveWorker}
                    onGPSCheckIn={(apt) => setGpsCheckInAppointment(apt)}
                  />
                )}
                {viewType === "month" && (
                  <SchedulerMonthView 
                    currentDate={currentDate}
                    appointments={appointments}
                    onAppointmentClick={(id) => {
                      const apt = appointments.find(a => a.id === id);
                      setDetailsAppointment(apt);
                    }}
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                    onRemoveWorker={handleRemoveWorker}
                    onGPSCheckIn={(apt) => setGpsCheckInAppointment(apt)}
                  />
                )}
                {viewType === "kanban" && (
                  <KanbanBoardView
                    appointments={appointments}
                    onAppointmentClick={(id) => {
                      const apt = appointments.find(a => a.id === id);
                      setDetailsAppointment(apt);
                    }}
                  />
                )}
                {viewType === "bryntum" && (
                  <BryntumSchedulerPlaceholder />
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
