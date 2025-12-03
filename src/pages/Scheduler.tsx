import { AUSTRALIAN_STATES } from "@/lib/constants/australianStates";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users, FileText, List, Undo2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { ViewToggleButton } from "@/components/layout/ViewToggleButton";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths, setHours, setMinutes, addHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import SchedulerDayView from "@/components/scheduler/SchedulerDayView";
import SchedulerWeekView from "@/components/scheduler/SchedulerWeekView";
import TimeGridWeekView from "@/components/scheduler/TimeGridWeekView";
import SchedulerMonthView from "@/components/scheduler/SchedulerMonthView";
import KanbanBoardView from "@/components/scheduler/KanbanBoardView";
import ServiceOrdersCalendarView from "@/components/scheduler/ServiceOrdersCalendarView";
import AppointmentDialog from "@/components/scheduler/AppointmentDialog";
import AppointmentDetailsDialog from "@/components/scheduler/AppointmentDetailsDialog";
import TemplatesDialog from "@/components/scheduler/TemplatesDialog";
import GPSCheckInDialog from "@/components/scheduler/GPSCheckInDialog";
import SmartSchedulingDialog from "@/components/scheduler/SmartSchedulingDialog";
import AuditDrawer from "@/components/audit/AuditDrawer";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import { usePresence } from "@/hooks/usePresence";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragCancelEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import ServiceOrdersSidebar from "@/components/scheduler/ServiceOrdersSidebar";
import DraggableWorker from "@/components/scheduler/DraggableWorker";
import { CapacityPlanningViewLazy } from "@/components/scheduler/CapacityPlanningViewLazy";
import { useAppointmentConflicts } from "@/hooks/useAppointmentConflicts";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DeleteDropZone from "@/components/scheduler/DeleteDropZone";

export default function Scheduler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewType, setViewType] = useState<"day" | "week" | "timegrid" | "month" | "kanban" | "capacity">("week");
  const [showServiceOrderView, setShowServiceOrderView] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | undefined>();
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [gpsCheckInAppointment, setGpsCheckInAppointment] = useState<any | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSmartScheduling, setShowSmartScheduling] = useState(false);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<Set<string>>(new Set());
  const [viewDetailsAppointmentId, setViewDetailsAppointmentId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Array<{
    type: 'appointment-move' | 'worker-add' | 'worker-remove' | 'bulk-move';
    data: any;
  }>>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [successWeek, setSuccessWeek] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();
  
  // Configure drag sensors with auto-scroll support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  const { onlineUsers, updateCursorPosition } = usePresence({ page: "scheduler" });
  const { checkConflict, checkAvailability } = useAppointmentConflicts();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [updateCursorPosition]);

  // Real-time subscriptions for appointments and worker assignments
  useEffect(() => {
    const appointmentsChannel = supabase
      .channel('scheduler-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Appointment change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }
      )
      .subscribe();

    const workersChannel = supabase
      .channel('scheduler-workers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_workers'
        },
        (payload) => {
          console.log('Worker assignment change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }
      )
      .subscribe();

    const serviceOrdersChannel = supabase
      .channel('scheduler-service-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_orders'
        },
        (payload) => {
          console.log('Service order change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ["service-orders-for-calendar"] });
          queryClient.invalidateQueries({ queryKey: ["service-orders-active"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(workersChannel);
      supabase.removeChannel(serviceOrdersChannel);
    };
  }, [queryClient]);

  // Keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack]);


  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", stateFilter],
    queryFn: async () => {
      // First, fetch appointments with service order data
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          *,
          service_orders(
            order_number, 
            title,
            customer_id,
            customer_location_id,
            customers(name)
          )
        `)
        .order("start_time", { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // If state filter is applied, fetch customer locations and filter
      let filteredAppointments = appointmentsData || [];
      if (stateFilter !== "all") {
        const customerLocationIds = filteredAppointments
          .map((apt: any) => apt.service_orders?.customer_location_id)
          .filter(Boolean);
        
        if (customerLocationIds.length > 0) {
          const { data: locations } = await supabase
            .from("customer_locations")
            .select("id, state")
            .in("id", customerLocationIds);
          
          const locationStateMap = (locations || []).reduce((acc: any, loc: any) => {
            acc[loc.id] = loc.state;
            return acc;
          }, {});
          
          filteredAppointments = filteredAppointments.filter((apt: any) => {
            const locationId = apt.service_orders?.customer_location_id;
            return locationId && locationStateMap[locationId] === stateFilter;
          });
        } else {
          filteredAppointments = [];
        }
      }
      
      // Then fetch all appointment_workers with profiles
      const { data: appointmentWorkersData, error: workersError } = await supabase
        .from("appointment_workers")
        .select(`
          appointment_id,
          worker_id,
          profiles(first_name, last_name)
        `);
      
      if (workersError) {
        console.error("Error fetching appointment workers:", workersError);
      }
      
      // Group workers by appointment_id
      const workersByAppointment = (appointmentWorkersData || []).reduce((acc: any, worker: any) => {
        if (!acc[worker.appointment_id]) {
          acc[worker.appointment_id] = [];
        }
        acc[worker.appointment_id].push(worker);
        return acc;
      }, {});
      
      // Fetch assigned profiles separately for appointments with assigned_to
      const appointmentsWithProfiles = await Promise.all(
        filteredAppointments.map(async (apt: any) => {
          const appointmentWorkers = workersByAppointment[apt.id] || [];
          
          if (!apt.assigned_to) return { 
            ...apt, 
            assigned_to_profile: null,
            appointment_workers: appointmentWorkers 
          };
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", apt.assigned_to)
            .maybeSingle();
          
          return { 
            ...apt, 
            assigned_to_profile: profile,
            appointment_workers: appointmentWorkers 
          };
        })
      );
      
      return appointmentsWithProfiles;
    },
  });

  // Fetch all active workers from workers view
  const { data: workers = [] } = useQuery({
    queryKey: ["workers", stateFilter],
    queryFn: async () => {
      // First, get all user IDs with worker role
      const { data: workerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      if (rolesError) throw rolesError;

      const workerUserIds = workerRoles?.map(r => r.user_id).filter(Boolean) || [];

      if (workerUserIds.length === 0) return [];

      // Query the workers view filtering by worker role users
      const { data: workersData, error: workersError } = await supabase
        .from("workers")
        .select("id, first_name, last_name, is_active, phone, avatar_url, preferred_days, preferred_start_time, preferred_end_time")
        .in("id", workerUserIds)
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (workersError) throw workersError;

      const workerIds = workersData?.map(w => w.id).filter(Boolean) || [];
      
      if (workerIds.length === 0) return [];

      // Fetch additional profile data for capacity planning and state filtering
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, standard_work_hours, employment_type, worker_state")
        .in("id", workerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch worker skills separately
      const { data: workerSkills } = await supabase
        .from("worker_skills")
        .select(`
          worker_id,
          skill_id,
          proficiency_level,
          skills(name)
        `)
        .in("worker_id", workerIds);

      // Combine workers with their skills and profile data
      let workersWithSkills = (workersData || []).map(worker => {
        const profile = profileMap.get(worker.id);
        return {
          ...worker,
          standard_work_hours: profile?.standard_work_hours,
          employment_type: profile?.employment_type,
          worker_state: profile?.worker_state,
          worker_skills: (workerSkills || [])
            .filter(ws => ws.worker_id === worker.id)
            .map(ws => ({
              skill_id: ws.skill_id,
              proficiency_level: ws.proficiency_level,
              skills: ws.skills
            }))
        };
      });

      // Filter by state if filter is applied
      if (stateFilter !== "all") {
        workersWithSkills = workersWithSkills.filter(worker => worker.worker_state === stateFilter);
      }

      return workersWithSkills;
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

  // Check for appointment query parameter and open details dialog
  useEffect(() => {
    const appointmentId = searchParams.get('appointment');
    if (appointmentId && appointments.length > 0) {
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (appointment) {
        setViewDetailsAppointmentId(appointmentId);
        // Clean up the URL parameter
        searchParams.delete('appointment');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, appointments, setSearchParams]);

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
      // Fetch service order with customer location data
      const { data: serviceOrder } = await supabase
        .from("service_orders")
        .select(`
          title, 
          description, 
          customer_id,
          customer_location_id
        `)
        .eq("id", serviceOrderId)
        .single();

      // Fetch location data from customer_locations if available
      let locationAddress = null;
      let locationLat = null;
      let locationLng = null;
      
      if (serviceOrder?.customer_location_id) {
        const { data: customerLocation } = await supabase
          .from("customer_locations")
          .select("formatted_address, address, latitude, longitude")
          .eq("id", serviceOrder.customer_location_id)
          .single();
        
        if (customerLocation) {
          locationAddress = customerLocation.formatted_address || customerLocation.address;
          locationLat = customerLocation.latitude;
          locationLng = customerLocation.longitude;
        }
      }

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
        location_address: locationAddress,
        location_lat: locationLat,
        location_lng: locationLng,
        status: "published",
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
      queryClient.invalidateQueries({ queryKey: ["service-orders-for-calendar"] });
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
    onMutate: async ({ appointmentId, startTime, endTime, workerId }) => {
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      const previousAppointments = queryClient.getQueryData(["appointments"]);

      queryClient.setQueryData(["appointments"], (old: any) => {
        return (old || []).map((apt: any) => {
          if (apt.id === appointmentId) {
            return {
              ...apt,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              assigned_to: workerId,
            };
          }
          return apt;
        });
      });

      return { previousAppointments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["service-orders-for-calendar"] });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(["appointments"], context.previousAppointments);
      }
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
      const { data: currentUser } = await supabase.auth.getUser();
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", currentUser.user?.id)
        .maybeSingle();

      const { error } = await supabase
        .from("appointment_workers")
        .insert({
          tenant_id: currentProfile?.tenant_id,
          appointment_id: appointmentId,
          worker_id: workerId,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error("Worker already assigned to this appointment");
        }
        throw error;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", workerId)
        .maybeSingle();

      return { workerId, profile };
    },
    onMutate: async ({ appointmentId, workerId }) => {
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      const previousAppointments = queryClient.getQueryData(["appointments"]);

      // Find worker name from existing workers data
      const worker = workers.find(w => w.id === workerId);

      queryClient.setQueryData(["appointments"], (old: any) => {
        return (old || []).map((apt: any) => {
          if (apt.id === appointmentId) {
            return {
              ...apt,
              appointment_workers: [
                ...(apt.appointment_workers || []),
                {
                  appointment_id: appointmentId,
                  worker_id: workerId,
                  profiles: worker ? { first_name: worker.first_name, last_name: worker.last_name } : null,
                }
              ]
            };
          }
          return apt;
        });
      });

      return { previousAppointments };
    },
    onSuccess: (_, { appointmentId, workerId }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      
      // Add to undo stack
      setUndoStack(prev => [...prev.slice(-4), {
        type: 'worker-add' as const,
        data: { appointmentId, workerId }
      }]);
      
      toast.success("Worker added", {
        action: {
          label: "Undo",
          onClick: () => handleUndo()
        }
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(["appointments"], context.previousAppointments);
      }
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

      const { data: remainingWorkers } = await supabase
        .from("appointment_workers")
        .select("id")
        .eq("appointment_id", appointmentId);

      if (!remainingWorkers || remainingWorkers.length === 0) {
        await supabase
          .from("appointments")
          .update({ assigned_to: null })
          .eq("id", appointmentId);
      }
    },
    onMutate: async ({ appointmentId, workerId }) => {
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      const previousAppointments = queryClient.getQueryData(["appointments"]);

      queryClient.setQueryData(["appointments"], (old: any) => {
        return (old || []).map((apt: any) => {
          if (apt.id === appointmentId) {
            const updatedWorkers = (apt.appointment_workers || []).filter(
              (w: any) => w.worker_id !== workerId
            );
            return {
              ...apt,
              appointment_workers: updatedWorkers,
              assigned_to: updatedWorkers.length === 0 ? null : apt.assigned_to,
            };
          }
          return apt;
        });
      });

      return { previousAppointments };
    },
    onSuccess: (_, { appointmentId, workerId }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      
      // Add to undo stack
      setUndoStack(prev => [...prev.slice(-4), {
        type: 'worker-remove' as const,
        data: { appointmentId, workerId }
      }]);
      
      toast.success("Worker removed", {
        action: {
          label: "Undo",
          onClick: () => handleUndo()
        }
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(["appointments"], context.previousAppointments);
      }
      toast.error(error.message || "Failed to remove worker");
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      // Check for time logs
      const { data: timeLogs } = await supabase
        .from("time_logs")
        .select("id")
        .eq("appointment_id", appointmentId)
        .limit(1);
      
      // Check for field reports
      const { data: fieldReports } = await supabase
        .from("field_reports")
        .select("id")
        .eq("appointment_id", appointmentId)
        .limit(1);
      
      if (timeLogs && timeLogs.length > 0) {
        throw new Error("Cannot delete: This appointment has time logs recorded. Please delete the time logs first.");
      }
      
      if (fieldReports && fieldReports.length > 0) {
        throw new Error("Cannot delete: This appointment has field reports. Please delete the field reports first.");
      }

      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["service-orders-for-calendar"] });
      toast.success("Appointment deleted");
      setViewDetailsAppointmentId(null);
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

  const handleSelectionChange = (appointmentId: string, selected: boolean) => {
    setSelectedAppointmentIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(appointmentId);
      } else {
        newSet.delete(appointmentId);
      }
      return newSet;
    });
  };

  const handleScheduleServiceOrderInWeek = async (
    serviceOrder: any, 
    weekStart: Date, 
    weekEnd: Date
  ) => {
    // Find workers with available capacity in this week
    const workersWithCapacity = workers
      .map(worker => {
        const standardHours = worker.standard_work_hours || 
          (worker.employment_type === 'full_time' ? 40 : 0);
        
        // Calculate scheduled hours for this worker in the week
        const scheduledHours = appointments
          .filter(apt => {
            const aptStart = new Date(apt.start_time);
            if (apt.status === 'cancelled') return false;
            if (aptStart < weekStart || aptStart > weekEnd) return false;
            
            const isPrimary = apt.assigned_to === worker.id;
            const isAssigned = apt.appointment_workers?.some((aw: any) => aw.worker_id === worker.id);
            
            return isPrimary || isAssigned;
          })
          .reduce((total, apt) => {
            const hours = (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / (1000 * 60 * 60);
            return total + hours;
          }, 0);

        const availableHours = Math.max(0, standardHours - scheduledHours);
        return { worker, availableHours, standardHours };
      })
      .filter(w => w.availableHours > 0)
      .sort((a, b) => b.availableHours - a.availableHours);

    if (workersWithCapacity.length === 0) {
      toast.error("No workers have available capacity this week");
      return;
    }

    // Select worker with most availability
    const bestWorker = workersWithCapacity[0].worker;
    const estimatedHours = serviceOrder.estimated_hours || 4;
    
    // Schedule on Monday of the week at 9 AM
    const startDate = new Date(weekStart);
    startDate.setDate(startDate.getDate() + (1 - startDate.getDay())); // Monday
    startDate.setHours(9, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + estimatedHours);

    try {
      await createAppointmentMutation.mutateAsync({
        serviceOrderId: serviceOrder.id,
        startTime: startDate,
        endTime: endDate,
        workerId: bestWorker.id,
      });
      
      // Trigger success animation
      setSuccessWeek(weekStart);
      setTimeout(() => setSuccessWeek(null), 600);
      
      toast.success(
        `Scheduled with ${bestWorker.first_name} ${bestWorker.last_name} who has ${workersWithCapacity[0].availableHours.toFixed(1)}h available`
      );
    } catch (error) {
      console.error("Error scheduling appointment:", error);
      toast.error("Failed to schedule appointment");
    }
  };

  const clearSelection = () => {
    setSelectedAppointmentIds(new Set());
  };

  const handleUndo = async () => {
    const lastAction = undoStack[undoStack.length - 1];
    if (!lastAction) return;

    setUndoStack(prev => prev.slice(0, -1));

    try {
      if (lastAction.type === 'appointment-move') {
        await Promise.all(
          lastAction.data.moves.map((move: any) =>
            supabase
              .from('appointments')
              .update({ 
                start_time: move.previousStart,
                end_time: move.previousEnd,
                assigned_to: move.previousAssignedTo
              })
              .eq('id', move.id)
          )
        );
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        toast.success(lastAction.data.moves.length > 1 ? "Bulk move undone" : "Move undone");
      } else if (lastAction.type === 'worker-add') {
        await supabase
          .from('appointment_workers')
          .delete()
          .eq('appointment_id', lastAction.data.appointmentId)
          .eq('worker_id', lastAction.data.workerId);
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        toast.success("Worker assignment undone");
      } else if (lastAction.type === 'worker-remove') {
        const { data: currentUser } = await supabase.auth.getUser();
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", currentUser.user?.id)
          .maybeSingle();

        await supabase
          .from('appointment_workers')
          .insert({
            tenant_id: currentProfile?.tenant_id,
            appointment_id: lastAction.data.appointmentId,
            worker_id: lastAction.data.workerId,
          });
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        toast.success("Worker removal undone");
      }
    } catch (error) {
      toast.error("Failed to undo action");
      console.error("Undo error:", error);
    }
  };

  const viewDetailsAppointment = appointments.find(apt => apt.id === viewDetailsAppointmentId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragCancel = (event: DragCancelEvent) => {
    setActiveId(null);
    setIsDragging(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    if (!over) return;

    const draggedItem = active.data.current;
    const dropTarget = over.data.current;
    const isDraggingSelectedAppointment = draggedItem?.isSelected && selectedAppointmentIds.size > 1;

    // Handle dropping appointment into delete zone
    if (over.id === "delete-zone" && draggedItem?.type === "appointment") {
      const appointmentId = draggedItem.appointmentId || draggedItem.appointment?.id;
      
      if (!appointmentId) {
        console.error("No appointment ID found for deletion");
        return;
      }
      
      if (isDraggingSelectedAppointment) {
        // Delete all selected appointments
        const appointmentsToDelete = Array.from(selectedAppointmentIds);
        appointmentsToDelete.forEach(id => {
          deleteAppointmentMutation.mutate(id);
        });
        clearSelection();
      } else {
        // Delete single appointment
        deleteAppointmentMutation.mutate(appointmentId);
      }
      return;
    }

    // Handle dropping worker onto appointment card
    if (draggedItem?.type === "worker" && dropTarget?.type === "appointment-card") {
      const workerId = draggedItem.worker.id;
      const appointmentId = dropTarget.appointmentId;
      addWorkerToAppointmentMutation.mutate({ appointmentId, workerId });
      return;
    }

    // Handle dropping worker onto time slot in SO calendar view to create appointment
    if (draggedItem?.type === "worker" && dropTarget?.type === "time-slot") {
      const workerId = draggedItem.worker.id;
      const { date, hour } = dropTarget;
      
      // Extract service order ID from slot ID (format: so-slot-{orderId}-{date})
      const slotId = over.id as string;
      if (slotId.startsWith("so-slot-")) {
        // Extract the service order UUID (36 chars) after "so-slot-"
        const serviceOrderId = slotId.substring(8, 44); // "so-slot-" is 8 chars, UUID is 36 chars
        
        // Calculate start and end times
        let startTime = hour !== undefined 
          ? setMinutes(setHours(date, hour), 0)
          : setHours(date, 9); // Default to 9 AM if no hour specified
        
        // Default 4 hour duration for service order appointments
        let endTime = addHours(startTime, 4);

        // Check for conflicts and find next available slot
        const workerAppointmentsOnDate = appointments.filter(apt => 
          apt.assigned_to === workerId &&
          new Date(apt.start_time).toDateString() === date.toDateString()
        ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        let hasConflict = true;
        let attemptCount = 0;
        const maxAttempts = 20;

        while (hasConflict && attemptCount < maxAttempts) {
          hasConflict = false;
          
          for (const apt of workerAppointmentsOnDate) {
            const aptStart = new Date(apt.start_time);
            const aptEnd = new Date(apt.end_time);
            
            if (startTime < aptEnd && endTime > aptStart) {
              hasConflict = true;
              startTime = new Date(aptEnd);
              endTime = addHours(startTime, 4);
              break;
            }
          }
          attemptCount++;
        }

        // Final conflict check
        const conflict = checkConflict(workerId, startTime, endTime);
        if (conflict.hasConflict) {
          toast.error(conflict.reason);
          return;
        }

        const availability = checkAvailability(workerId, startTime, endTime);
        if (!availability.isAvailable) {
          toast.warning(availability.reason || "Worker may not be available");
        }

        createAppointmentMutation.mutate({
          serviceOrderId,
          startTime,
          endTime,
          workerId,
        });
        return;
      }
    }

    // Handle dropping a service order on capacity week
    if (draggedItem?.type === "service-order" && dropTarget?.type === "capacity-week") {
      const serviceOrder = draggedItem.serviceOrder;
      const { weekStart, weekEnd } = dropTarget;
      
      handleScheduleServiceOrderInWeek(serviceOrder, weekStart, weekEnd);
      return;
    }

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
      
      // Get all appointments to move (selected or just the one)
      const appointmentsToMove = isDraggingSelectedAppointment
        ? appointments.filter(apt => selectedAppointmentIds.has(apt.id))
        : [appointment];

      // Move all appointments
      appointmentsToMove.forEach(apt => {
        const originalStart = new Date(apt.start_time);
        const originalEnd = new Date(apt.end_time);
        const durationMs = originalEnd.getTime() - originalStart.getTime();
        
        let aptStartTime = new Date(date);
        
        // If hour is not specified (ServiceOrdersCalendarView), keep original time but change date
        if (hour === undefined) {
          const newDate = new Date(date);
          newDate.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
          aptStartTime = newDate;
        } else {
          aptStartTime.setHours(hour, 0, 0, 0);
        }
        
        let aptEndTime = new Date(aptStartTime.getTime() + durationMs);

        // Check if appointment is actually being moved
        const isSameTime = 
          aptStartTime.getTime() === originalStart.getTime() &&
          aptEndTime.getTime() === originalEnd.getTime();
        const isSameWorker = workerId === apt.assigned_to || (workerId === null && apt.assigned_to === null);

        // Skip update if nothing changed
        if (isSameTime && isSameWorker && !isMultiAssign) {
          return;
        }

        // Check for existing appointments and find next available slot
        if (workerId) {
          // Find all appointments for this worker on this date (excluding appointments being moved)
          const workerAppointmentsOnDate = appointments.filter(apt => 
            !appointmentsToMove.some(movingApt => movingApt.id === apt.id) &&
            apt.assigned_to === workerId &&
            new Date(apt.start_time).toDateString() === date.toDateString()
          ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

          // Check if proposed time conflicts with existing appointments
          let hasConflict = true;
          let attemptCount = 0;
          const maxAttempts = 20;

          while (hasConflict && attemptCount < maxAttempts) {
            hasConflict = false;
            
            for (const existingApt of workerAppointmentsOnDate) {
              const aptStart = new Date(existingApt.start_time);
              const aptEnd = new Date(existingApt.end_time);
              
              // Check if times overlap
              if (aptStartTime < aptEnd && aptEndTime > aptStart) {
                hasConflict = true;
                // Move to immediately after this appointment
                aptStartTime = new Date(aptEnd);
                aptEndTime = new Date(aptStartTime.getTime() + durationMs);
                break;
              }
            }
            attemptCount++;
          }

          // Final conflict check
          const conflict = checkConflict(workerId, aptStartTime, aptEndTime, apt.id);
          if (conflict.hasConflict) {
            toast.error(conflict.reason);
            return;
          }

          const availability = checkAvailability(workerId, aptStartTime, aptEndTime);
          if (!availability.isAvailable) {
            toast.warning(availability.reason || "Worker may not be available");
          }
        }

        if (isMultiAssign && workerId) {
          // Add worker to appointment (multi-assign)
          addWorkerToAppointmentMutation.mutate({
            appointmentId: apt.id,
            workerId,
          });
        } else {
          // Store previous state for undo
          const moves = appointmentsToMove.map(a => ({
            id: a.id,
            previousStart: a.start_time,
            previousEnd: a.end_time,
            previousAssignedTo: a.assigned_to
          }));

          // Move appointment (reassign)
          updateAppointmentMutation.mutate({
            appointmentId: apt.id,
            startTime: aptStartTime,
            endTime: aptEndTime,
            workerId: workerId || apt.assigned_to,
          });

          // Add to undo stack after last mutation
          if (apt.id === appointmentsToMove[appointmentsToMove.length - 1].id) {
            setUndoStack(prev => [...prev.slice(-4), {
              type: 'appointment-move' as const,
              data: { moves }
            }]);
            
            const moveCount = moves.length;
            toast.success(moveCount > 1 ? `${moveCount} appointments moved` : "Appointment moved", {
              action: {
                label: "Undo",
                onClick: () => handleUndo()
              }
            });
          }
        }
      });

      // Clear selection after bulk move
      if (isDraggingSelectedAppointment) {
        clearSelection();
      }
    }
  };

  return (
    <DashboardLayout>
      
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

      {gpsCheckInAppointment && (
        <GPSCheckInDialog
          appointment={gpsCheckInAppointment}
          open={!!gpsCheckInAppointment}
          onOpenChange={(open) => !open && setGpsCheckInAppointment(null)}
        />
      )}

      <DndContext 
        sensors={sensors}
        autoScroll={{
          enabled: true,
          acceleration: 15,
          threshold: {
            x: 0.1,
            y: 0.1,
          },
        }}
        onDragEnd={handleDragEnd} 
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
      >
        <DeleteDropZone isVisible={isDragging} />
        <div className="overflow-x-auto overflow-y-hidden h-[calc(100vh-64px)]">
          <div className={cn(
            "grid gap-3 h-full transition-all duration-300 min-w-[900px]",
            sidebarCollapsed ? "grid-cols-[1fr]" : "grid-cols-[1fr_280px]"
          )}>
            <div className="flex flex-col min-h-0">
        
        {/* Calendar Controls */}
        <Card className="shadow-md flex flex-col min-h-0 flex-1">
          <CardHeader className="p-2 flex-shrink-0 border-b">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  className="h-7 text-[11px] px-2"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
                <h3 className="text-xs font-semibold ml-1">{getDateRangeLabel()}</h3>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger className="h-7 w-[160px] text-[10px]">
                    <SelectValue placeholder="Filter by state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[10px]">All States</SelectItem>
                    {AUSTRALIAN_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value} className="text-[10px]">
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                {/* View Controls Group */}
                <div className="flex items-center gap-1.5">
                  <ViewToggleButton />
                </div>
                
                <div className="h-5 w-px bg-border" /> {/* Divider */}
                
                {/* Action Controls Group */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                  >
                    {sidebarCollapsed ? <PanelRightOpen className="h-3 w-3" /> : <PanelRightClose className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Undo
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={handlePublishAllDraft}
                    disabled={!appointments.some(apt => apt.status === "draft")}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Publish
                  </Button>
                </div>
                
                <div className="h-5 w-px bg-border" /> {/* Divider */}
                
                {/* View Type Controls Group */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <Switch 
                      id="service-order-view" 
                      checked={showServiceOrderView}
                      onCheckedChange={setShowServiceOrderView}
                      className="scale-75"
                    />
                    <Label htmlFor="service-order-view" className="text-[10px] cursor-pointer">
                      <List className="h-3 w-3 inline mr-0.5" />
                      SO
                    </Label>
                  </div>
                  {!showServiceOrderView && (
                    <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)}>
                      <TabsList className="h-7">
                        <TabsTrigger value="day" className="text-[10px] px-2 py-0">Day</TabsTrigger>
                        <TabsTrigger value="week" className="text-[10px] px-2 py-0">Week</TabsTrigger>
                        <TabsTrigger value="timegrid" className="text-[10px] px-2 py-0">Grid</TabsTrigger>
                        <TabsTrigger value="month" className="text-[10px] px-2 py-0">Month</TabsTrigger>
                        <TabsTrigger value="kanban" className="text-[10px] px-2 py-0">Kanban</TabsTrigger>
                        <TabsTrigger value="capacity" className="text-[10px] px-2 py-0">Capacity</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading appointments...</div>
            ) : viewType === "capacity" ? (
              <CapacityPlanningViewLazy
                workers={workers.map(w => ({
                  ...w,
                  full_name: `${w.first_name} ${w.last_name}`
                }))}
                currentDate={currentDate}
                onScheduleServiceOrder={handleScheduleServiceOrderInWeek}
                successWeek={successWeek}
              />
            ) : showServiceOrderView ? (
              <ServiceOrdersCalendarView 
                currentDate={currentDate}
                appointments={appointments}
                viewType={viewType}
                stateFilter={stateFilter}
                onAppointmentClick={setViewDetailsAppointmentId}
                onCreateAppointment={(serviceOrderId, date, startTime, endTime) => {
                  const [hours, minutes] = startTime.split(':');
                  const [endHours, endMinutes] = endTime.split(':');
                  const start = new Date(date);
                  start.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                  const end = new Date(date);
                  end.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
                  
                  createAppointmentMutation.mutate({
                    serviceOrderId,
                    startTime: start,
                    endTime: end,
                    workerId: null,
                  });
                }}
                onRemoveWorker={handleRemoveWorker}
              />
            ) : (
              <>
                {viewType === "day" && (
                  <SchedulerDayView 
                    currentDate={currentDate} 
                    appointments={appointments}
                    onAppointmentClick={setViewDetailsAppointmentId}
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
                    onAppointmentClick={setViewDetailsAppointmentId}
                    onEditAppointment={(id) => {
                      setEditingAppointmentId(id);
                      setDialogOpen(true);
                    }}
                    onRemoveWorker={handleRemoveWorker}
                    onGPSCheckIn={(apt) => setGpsCheckInAppointment(apt)}
                    checkAvailability={checkAvailability}
                  />
                )}
                {viewType === "timegrid" && (
                  <TimeGridWeekView 
                    currentDate={currentDate}
                    appointments={appointments}
                    workers={workers}
                    onAppointmentClick={setViewDetailsAppointmentId}
                    onRemoveWorker={handleRemoveWorker}
                    onResizeAppointment={(appointmentId, newStartTime, newEndTime) => {
                      const appointment = appointments.find(a => a.id === appointmentId);
                      updateAppointmentMutation.mutate({
                        appointmentId,
                        startTime: newStartTime,
                        endTime: newEndTime,
                        workerId: appointment?.assigned_to || null,
                      });
                      toast.success("Appointment time updated");
                    }}
                    onCreateAppointment={(workerId, date, hour) => {
                      const start = new Date(date);
                      start.setHours(hour, 0, 0, 0);
                      const end = new Date(start);
                      end.setHours(hour + 1, 0, 0, 0);
                      
                      setEditingAppointmentId(undefined);
                      setDialogOpen(true);
                    }}
                  />
                )}
                {viewType === "month" && (
                  <SchedulerMonthView 
                    currentDate={currentDate}
                    appointments={appointments}
                    onAppointmentClick={setViewDetailsAppointmentId}
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
                    onAppointmentClick={setViewDetailsAppointmentId}
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

            {/* Right Sidebar - Service Orders or Workers depending on view */}
            {!sidebarCollapsed && (
              <>
                {!showServiceOrderView ? (
                  <div className="flex flex-col min-h-0">
                    <ServiceOrdersSidebar 
                      onSelectWorkerForOrder={handleSelectWorkerForOrder}
                      stateFilter={stateFilter}
                    />
                  </div>
                ) : (
                  <Card className="h-full flex flex-col min-h-0">
                    <CardHeader className="p-2 flex-shrink-0">
                      <CardTitle className="text-xs">Workers</CardTitle>
                      <p className="text-[10px] text-muted-foreground">
                        Drag to appointments
                      </p>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                      <ScrollArea className="h-full px-2 pb-2">
                        <div className="space-y-2">
                          {workers.map(worker => (
                            <DraggableWorker key={worker.id} worker={worker} />
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Drag Overlay - shows the item being dragged */}
        <DragOverlay dropAnimation={null}>
          {activeId && (() => {
            // Appointment being dragged
            if (activeId.toString().startsWith('appointment-')) {
              const appointmentId = activeId.toString().replace('appointment-', '');
              const appointment = appointments.find(a => a.id === appointmentId);
              if (appointment) {
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case "draft": return "bg-muted text-muted-foreground";
                    case "scheduled": return "bg-info/10 text-info";
                    case "in_progress": return "bg-warning/10 text-warning";
                    case "completed": return "bg-success/10 text-success";
                    case "cancelled": return "bg-destructive/10 text-destructive";
                    default: return "bg-muted text-muted-foreground";
                  }
                };
                
                return (
                  <Card className="p-2 shadow-2xl ring-2 ring-primary rotate-3 scale-105 w-[280px]">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="outline" className={getStatusColor(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-sm truncate">{appointment.title}</h4>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(appointment.start_time), "HH:mm")} - 
                          {format(new Date(appointment.end_time), "HH:mm")}
                        </span>
                      </div>
                      {appointment.appointment_workers && appointment.appointment_workers.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span className="truncate">
                            {appointment.appointment_workers.map((aw: any) => 
                              `${aw.profiles?.first_name || ''} ${aw.profiles?.last_name || ''}`
                            ).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              }
            }
            // Worker being dragged
            if (activeId.toString().startsWith('worker-')) {
              const workerId = activeId.toString().replace('worker-', '');
              const worker = workers.find(w => w.id === workerId);
              if (worker) {
                return <DraggableWorker worker={worker} isDragOverlay />;
              }
            }
            // Service order being dragged
            if (activeId.toString().startsWith('service-order-')) {
              const serviceOrderId = activeId.toString().replace('service-order-', '');
              const serviceOrder = serviceOrders.find(so => so.id === serviceOrderId);
              if (serviceOrder) {
                // Calculate remaining hours for display
                const scheduledAppointments = appointments.filter(apt => apt.service_order_id === serviceOrder.id);
                const totalScheduledHours = scheduledAppointments.reduce((sum, apt) => {
                  const workers = apt.appointment_workers?.length || 0;
                  const start = new Date(apt.start_time);
                  const end = new Date(apt.end_time);
                  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  return sum + (hours * workers);
                }, 0);
                const remainingHours = (serviceOrder.estimated_hours || 0) - totalScheduledHours;
                
                return (
                  <Card className="p-2 shadow-2xl ring-2 ring-primary rotate-3 scale-105 w-[280px]">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {serviceOrder.order_number}
                            </Badge>
                          </div>
                          <h4 className="font-semibold text-xs mt-1 truncate">{serviceOrder.title}</h4>
                        </div>
                      </div>
                      {serviceOrder.estimated_hours && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Need {remainingHours.toFixed(1)}h</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              }
            }
            return null;
          })()}
        </DragOverlay>
      </DndContext>

      <AppointmentDetailsDialog
        appointment={viewDetailsAppointment}
        open={!!viewDetailsAppointmentId}
        onOpenChange={(open) => {
          if (!open) setViewDetailsAppointmentId(null);
        }}
        onEdit={() => {
          if (viewDetailsAppointmentId) {
            setEditingAppointmentId(viewDetailsAppointmentId);
            setDialogOpen(true);
            setViewDetailsAppointmentId(null);
          }
        }}
      />
    </DashboardLayout>
  );
}
