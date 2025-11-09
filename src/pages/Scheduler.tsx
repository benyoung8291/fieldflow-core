import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users, FileText, List, Sparkles } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths, setHours, setMinutes, addHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import SchedulerDayView from "@/components/scheduler/SchedulerDayView";
import SchedulerWeekView from "@/components/scheduler/SchedulerWeekView";
import SchedulerMonthView from "@/components/scheduler/SchedulerMonthView";
import KanbanBoardView from "@/components/scheduler/KanbanBoardView";
import ServiceOrdersCalendarView from "@/components/scheduler/ServiceOrdersCalendarView";
import AppointmentDialog from "@/components/scheduler/AppointmentDialog";
import TemplatesDialog from "@/components/scheduler/TemplatesDialog";
import AppointmentDetailsDialog from "@/components/scheduler/AppointmentDetailsDialog";
import GPSCheckInDialog from "@/components/scheduler/GPSCheckInDialog";
import SmartSchedulingDialog from "@/components/scheduler/SmartSchedulingDialog";
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
  const [viewType, setViewType] = useState<"day" | "week" | "month" | "kanban">("week");
  const [showServiceOrderView, setShowServiceOrderView] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [detailsAppointment, setDetailsAppointment] = useState<any | null>(null);
  const [gpsCheckInAppointment, setGpsCheckInAppointment] = useState<any | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSmartScheduling, setShowSmartScheduling] = useState(false);
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
          appointment_workers(worker_id, profiles(first_name, last_name))
        `)
        .order("start_time", { ascending: true });

      if (error) throw error;
      
      // Fetch assigned profiles separately to avoid FK issues with null values
      const appointmentsWithProfiles = await Promise.all(
        (data || []).map(async (apt: any) => {
          if (!apt.assigned_to) return { ...apt, assigned_to_profile: null };
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", apt.assigned_to)
            .maybeSingle();
          
          return { ...apt, assigned_to_profile: profile };
        })
      );
      
      return appointmentsWithProfiles;
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

  // Fetch service orders for smart scheduling
  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["service-orders-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("id, order_number, title, estimated_hours")
        .in("status", ["draft", "scheduled", "in_progress"])
        .order("created_at", { ascending: false });

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
        appointment_workers(worker_id, profiles(first_name, last_name))
      `).single();

      if (error) throw error;
      
      // Fetch assigned profile if exists
      let assignedProfile = null;
      if (newAppointment && workerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", workerId)
          .maybeSingle();
        assignedProfile = profile;
      }

      // Add to appointment_workers junction table
      if (workerId && newAppointment) {
        await supabase.from("appointment_workers").insert({
          tenant_id: profile?.tenant_id,
          appointment_id: newAppointment.id,
          worker_id: workerId,
        });
      }

      return { ...newAppointment, assigned_to_profile: assignedProfile };
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

  const handleSmartSchedule = async (
    workerId: string,
    serviceOrderId: string,
    startTime: Date,
    endTime: Date
  ) => {
    try {
      await createAppointmentMutation.mutateAsync({
        serviceOrderId,
        startTime,
        endTime,
        workerId,
      });
      setShowSmartScheduling(false);
    } catch (error) {
      console.error("Failed to create appointment:", error);
    }
  };

  const handleSelectWorkerForOrder = async (
    workerId: string, 
    serviceOrderId: string, 
    suggestedDate?: string
  ) => {
    const serviceOrder = serviceOrders.find(so => so.id === serviceOrderId);
    if (!serviceOrder) return;

    const duration = serviceOrder.estimated_hours || 2;
    const startDate = suggestedDate ? new Date(suggestedDate) : new Date(currentDate);
    startDate.setHours(9, 0, 0, 0); // Default to 9 AM
    
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + duration);

    try {
      await createAppointmentMutation.mutateAsync({
        serviceOrderId,
        startTime: startDate,
        endTime: endDate,
        workerId,
      });
      toast.success("Appointment scheduled with recommended worker");
    } catch (error) {
      console.error("Error scheduling appointment:", error);
      toast.error("Failed to schedule appointment");
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
    let startTime = hour !== undefined 
      ? setMinutes(setHours(date, hour), 0)
      : setHours(date, 18); // Default to 6 PM if no hour specified

    // For service orders, use 4 hour default, otherwise 2 hours
    const defaultDuration = draggedItem?.type === "service-order" ? 4 : 2;
    let endTime = addHours(startTime, defaultDuration);

    // Handle dropping a service order
    if (draggedItem?.type === "service-order") {
      const serviceOrder = draggedItem.serviceOrder;

      // Check for existing appointments and find next available slot
      if (workerId) {
        // Find all appointments for this worker on this date
        const workerAppointmentsOnDate = appointments.filter(apt => 
          apt.assigned_to === workerId &&
          new Date(apt.start_time).toDateString() === date.toDateString()
        ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        // Check if proposed time conflicts with existing appointments
        let hasConflict = true;
        let attemptCount = 0;
        const maxAttempts = 20; // Prevent infinite loops

        while (hasConflict && attemptCount < maxAttempts) {
          hasConflict = false;
          
          for (const apt of workerAppointmentsOnDate) {
            const aptStart = new Date(apt.start_time);
            const aptEnd = new Date(apt.end_time);
            
            // Check if times overlap
            if (startTime < aptEnd && endTime > aptStart) {
              hasConflict = true;
              // Move to immediately after this appointment
              startTime = new Date(aptEnd);
              endTime = addHours(startTime, defaultDuration);
              break;
            }
          }
          attemptCount++;
        }

        // Final conflict check with availability
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
      let newEndTime = new Date(startTime.getTime() + durationMs);

      // Check for existing appointments and find next available slot
      if (workerId) {
        // Find all appointments for this worker on this date (excluding current one)
        const workerAppointmentsOnDate = appointments.filter(apt => 
          apt.id !== appointment.id &&
          apt.assigned_to === workerId &&
          new Date(apt.start_time).toDateString() === date.toDateString()
        ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        // Check if proposed time conflicts with existing appointments
        let hasConflict = true;
        let attemptCount = 0;
        const maxAttempts = 20;

        while (hasConflict && attemptCount < maxAttempts) {
          hasConflict = false;
          
          for (const apt of workerAppointmentsOnDate) {
            const aptStart = new Date(apt.start_time);
            const aptEnd = new Date(apt.end_time);
            
            // Check if times overlap
            if (startTime < aptEnd && newEndTime > aptStart) {
              hasConflict = true;
              // Move to immediately after this appointment
              startTime = new Date(aptEnd);
              newEndTime = new Date(startTime.getTime() + durationMs);
              break;
            }
          }
          attemptCount++;
        }

        // Final conflict check
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

      <SmartSchedulingDialog
        open={showSmartScheduling}
        onOpenChange={setShowSmartScheduling}
        serviceOrders={serviceOrders}
        workers={workers}
        onSchedule={handleSmartSchedule}
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
        <div className="grid grid-cols-[1fr_300px] gap-3">
          <div className="space-y-2">
        {/* Compact Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="shadow-sm">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">Today</p>
                </div>
                <p className="text-base font-bold">{todayAppointments.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">Workers</p>
                </div>
                <p className="text-base font-bold">{activeWorkers}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">Active</p>
                </div>
                <p className="text-base font-bold">{checkedInAppointments.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Controls */}
        <Card className="shadow-md">
          <CardHeader className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 text-xs px-3"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <h3 className="text-sm font-semibold ml-2">{getDateRangeLabel()}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowSmartScheduling(true)}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Smart Schedule
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handlePublishAllDraft}
                  disabled={!appointments.some(apt => apt.status === "draft")}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Publish Drafts
                </Button>
                <div className="flex items-center gap-1.5">
                  <Switch 
                    id="service-order-view" 
                    checked={showServiceOrderView}
                    onCheckedChange={setShowServiceOrderView}
                    className="scale-90"
                  />
                  <Label htmlFor="service-order-view" className="text-xs cursor-pointer">
                    <List className="h-3.5 w-3.5 inline mr-1" />
                    SO View
                  </Label>
                </div>
                <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="day" className="text-xs px-2.5">Day</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs px-2.5">Week</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs px-2.5">Month</TabsTrigger>
                    <TabsTrigger value="kanban" className="text-xs px-2.5">Kanban</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2">
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
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                    onRemoveWorker={handleRemoveWorker}
                    onGPSCheckIn={(apt) => setGpsCheckInAppointment(apt)}
                    onDeleteAppointment={handleDeleteAppointment}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
          </div>

          {/* Draggable Service Orders Sidebar */}
          <div>
            <ServiceOrdersSidebar onSelectWorkerForOrder={handleSelectWorkerForOrder} />
          </div>
        </div>
      </DndContext>
    </DashboardLayout>
  );
}
