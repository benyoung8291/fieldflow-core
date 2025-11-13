import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Repeat } from "lucide-react";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";
import RecurrenceDialog from "./RecurrenceDialog";
import RecurringEditDialog from "./RecurringEditDialog";
import SaveTemplateDialog from "./SaveTemplateDialog";
import { generateRecurringInstances, checkRecurringConflicts } from "@/hooks/useRecurringAppointments";
import { Badge } from "@/components/ui/badge";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import WorkerSuggestions from "./WorkerSuggestions";
import AddressAutocomplete from "@/components/customers/AddressAutocomplete";

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId?: string;
  defaultDate?: Date;
  defaultServiceOrderId?: string;
}

export default function AppointmentDialog({ 
  open, 
  onOpenChange, 
  appointmentId,
  defaultDate,
  defaultServiceOrderId
}: AppointmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [currentField, setCurrentField] = useState<string>("");
  
  const { onlineUsers, updateField, updateCursorPosition } = usePresence({
    page: "appointment-dialog",
    field: currentField,
  });

  useEffect(() => {
    if (!open) return;
    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [open, updateCursorPosition]);
  
  const [formData, setFormData] = useState({
    service_order_id: defaultServiceOrderId || "",
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    assigned_to: "",
    status: "draft",
    location_address: "",
    location_lat: "",
    location_lng: "",
    gps_check_in_radius: "100",
    notes: "",
  });

  // Service order fields for creating new appointments
  const [serviceOrderData, setServiceOrderData] = useState({
    customer_id: "",
    title: "",
    description: "",
    priority: "normal",
  });
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [createNewServiceOrder, setCreateNewServiceOrder] = useState(!defaultServiceOrderId);

  const [recurrenceConfig, setRecurrenceConfig] = useState<any>(null);
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);
  const [showRecurringEditDialog, setShowRecurringEditDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [parentAppointmentId, setParentAppointmentId] = useState<string | null>(null);
  const [assignedWorkers, setAssignedWorkers] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      fetchCustomers();
      fetchServiceOrders();
      fetchTechnicians();
      if (appointmentId) {
        fetchAppointment();
        setCreateNewServiceOrder(false);
      } else {
        resetForm();
        setCreateNewServiceOrder(!defaultServiceOrderId);
        if (defaultDate) {
          const dateStr = defaultDate.toISOString().slice(0, 16);
          setFormData(prev => ({ ...prev, start_time: dateStr }));
        }
      }
    }
  }, [open, appointmentId, defaultDate, defaultServiceOrderId]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (error) {
      toast({ title: "Error fetching customers", variant: "destructive" });
    } else {
      setCustomers(data || []);
    }
  };

  const fetchServiceOrders = async () => {
    const { data, error } = await supabase
      .from("service_orders")
      .select("id, order_number, title")
      .in("status", ["scheduled", "in_progress"])
      .order("order_number");
    
    if (error) {
      toast({ title: "Error fetching service orders", variant: "destructive" });
    } else {
      setServiceOrders(data || []);
    }
  };

  const fetchTechnicians = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name");
    
    if (error) {
      toast({ title: "Error fetching technicians", variant: "destructive" });
    } else {
      setTechnicians(data || []);
    }
  };

  const fetchAppointment = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .single();
    
    if (error) {
      toast({ title: "Error fetching appointment", variant: "destructive" });
    } else if (data) {
      setFormData({
        service_order_id: data.service_order_id || "",
        title: data.title || "",
        description: data.description || "",
        start_time: data.start_time?.slice(0, 16) || "",
        end_time: data.end_time?.slice(0, 16) || "",
        assigned_to: data.assigned_to || "",
        status: data.status || "draft",
        location_address: data.location_address || "",
        location_lat: data.location_lat?.toString() || "",
        location_lng: data.location_lng?.toString() || "",
        gps_check_in_radius: data.gps_check_in_radius?.toString() || "100",
        notes: data.notes || "",
      });
      
      // Fetch assigned workers
      const { data: workers } = await supabase
        .from("appointment_workers")
        .select("worker_id, profiles(id, first_name, last_name)")
        .eq("appointment_id", appointmentId);
      
      if (workers) {
        setAssignedWorkers(workers.map((w: any) => ({
          id: w.worker_id,
          first_name: w.profiles.first_name,
          last_name: w.profiles.last_name,
        })));
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      service_order_id: defaultServiceOrderId || "",
      title: "",
      description: "",
      start_time: "",
      end_time: "",
      assigned_to: "",
      status: "draft",
      location_address: "",
      location_lat: "",
      location_lng: "",
      gps_check_in_radius: "100",
      notes: "",
    });
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            location_lat: position.coords.latitude.toString(),
            location_lng: position.coords.longitude.toString(),
          }));
          toast({ title: "Location captured successfully" });
        },
        (error) => {
          toast({ 
            title: "Error getting location", 
            description: error.message,
            variant: "destructive" 
          });
        }
      );
    } else {
      toast({ 
        title: "Geolocation not supported", 
        variant: "destructive" 
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If editing recurring appointment, show dialog
    if (appointmentId && (isRecurring || parentAppointmentId)) {
      setShowRecurringEditDialog(true);
      return;
    }
    
    await saveAppointment("single");
  };

  const saveAppointment = async (editType: "single" | "series") => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not authenticated", variant: "destructive" });
        return;
      }

      let serviceOrderId = formData.service_order_id;

      // Create service order if needed
      if (createNewServiceOrder && !appointmentId) {
        if (!serviceOrderData.customer_id || !serviceOrderData.title) {
          toast({ 
            title: "Missing required fields", 
            description: "Customer and Service Order Title are required",
            variant: "destructive" 
          });
          setLoading(false);
          return;
        }

        // Get user's tenant_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (!profile?.tenant_id) {
          toast({ 
            title: "Error", 
            description: "Unable to determine tenant",
            variant: "destructive" 
          });
          setLoading(false);
          return;
        }

        const { data: newServiceOrder, error: soError } = await supabase
          .from("service_orders")
          .insert([{
            customer_id: serviceOrderData.customer_id,
            title: serviceOrderData.title,
            description: serviceOrderData.description,
            priority: serviceOrderData.priority,
            status: "draft",
            order_number: `SO-${Date.now()}`,
            created_by: user.id,
            tenant_id: profile.tenant_id,
          }])
          .select()
          .single();

        if (soError) {
          toast({ 
            title: "Error creating service order", 
            description: soError.message,
            variant: "destructive" 
          });
          setLoading(false);
          return;
        }

        serviceOrderId = newServiceOrder.id;
        queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      }

      if (!serviceOrderId) {
        toast({ 
          title: "Service order required", 
          description: "Please select or create a service order",
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      const appointmentData: any = {
        service_order_id: serviceOrderId,
        title: formData.title,
        description: formData.description,
        start_time: formData.start_time,
        end_time: formData.end_time,
        assigned_to: formData.assigned_to || null,
        status: formData.status,
        location_address: formData.location_address,
        location_lat: formData.location_lat ? parseFloat(formData.location_lat) : null,
        location_lng: formData.location_lng ? parseFloat(formData.location_lng) : null,
        gps_check_in_radius: parseInt(formData.gps_check_in_radius),
        notes: formData.notes,
        is_recurring: recurrenceConfig ? true : false,
        recurrence_pattern: recurrenceConfig?.pattern || null,
        recurrence_frequency: recurrenceConfig?.frequency || null,
        recurrence_end_date: recurrenceConfig?.endDate ? recurrenceConfig.endDate.toISOString().split('T')[0] : null,
        recurrence_days_of_week: recurrenceConfig?.daysOfWeek || null,
      };

      if (!appointmentId) {
        appointmentData.created_by = user.id;
      }

      if (appointmentId) {
        // Editing existing appointment
        if (editType === "series" && (isRecurring || parentAppointmentId)) {
          // Update all future appointments in the series
          const targetId = parentAppointmentId || appointmentId;
          const { error } = await supabase
            .from("appointments")
            .update(appointmentData)
            .or(`id.eq.${targetId},parent_appointment_id.eq.${targetId}`)
            .gte("start_time", formData.start_time);

          if (error) throw error;
          toast({ title: "Recurring series updated successfully" });
        } else {
          // Update single appointment
          const { error } = await supabase
            .from("appointments")
            .update(appointmentData)
            .eq("id", appointmentId);

          if (error) throw error;
          toast({ title: "Appointment updated successfully" });
        }
        
        // Update appointment workers if editing
        if (appointmentId) {
          // Remove existing workers
          await supabase
            .from("appointment_workers")
            .delete()
            .eq("appointment_id", appointmentId);
          
          // Add new workers
          if (assignedWorkers.length > 0) {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
              .from("profiles")
              .select("tenant_id")
              .eq("id", user!.id)
              .single();
              
            await supabase
              .from("appointment_workers")
              .insert(
                assignedWorkers.map(worker => ({
                  appointment_id: appointmentId,
                  worker_id: worker.id,
                  tenant_id: profile!.tenant_id,
                }))
              );
          }
        }
      } else {
        // Creating new appointment(s)
        if (recurrenceConfig) {
          // Generate recurring instances
          const template = {
            start_time: new Date(formData.start_time),
            end_time: new Date(formData.end_time),
            title: formData.title,
            description: formData.description,
            assigned_to: formData.assigned_to,
            location_address: formData.location_address,
            location_lat: formData.location_lat ? parseFloat(formData.location_lat) : undefined,
            location_lng: formData.location_lng ? parseFloat(formData.location_lng) : undefined,
          };

          const instances = generateRecurringInstances(template, recurrenceConfig);

          // Check for conflicts
          if (formData.assigned_to) {
            const { data: existingAppointments } = await supabase
              .from("appointments")
              .select("*")
              .eq("assigned_to", formData.assigned_to)
              .neq("status", "cancelled");

            const conflicts = checkRecurringConflicts(
              instances,
              existingAppointments || [],
              formData.assigned_to
            );

            if (conflicts.length > 0) {
              toast({
                title: "Conflicts detected",
                description: `${conflicts.length} appointments conflict with existing schedule`,
                variant: "destructive",
              });
              setLoading(false);
              return;
            }
          }

          // Create parent appointment
          const { data: parentAppt, error: parentError } = await supabase
            .from("appointments")
            .insert([{ ...appointmentData, created_by: user.id }])
            .select()
            .single();

          if (parentError) throw parentError;

          // Create recurring instances
          const recurringData = instances.slice(1).map(instance => ({
            ...appointmentData,
            start_time: instance.start_time.toISOString(),
            end_time: instance.end_time.toISOString(),
            created_by: user.id,
            parent_appointment_id: parentAppt.id,
          }));

          if (recurringData.length > 0) {
            const { error: instanceError } = await supabase
              .from("appointments")
              .insert(recurringData);

            if (instanceError) throw instanceError;
          }

          toast({ 
            title: "Recurring appointments created", 
            description: `Created ${instances.length} appointments`
          });
        } else {
          // Single appointment
          const { error } = await supabase
            .from("appointments")
            .insert([{ ...appointmentData, created_by: user.id }]);

          if (error) throw error;
          toast({ title: "Appointment created successfully" });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Error saving appointment", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <RemoteCursors users={onlineUsers} />
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{appointmentId ? "Edit" : "Create"} Appointment</DialogTitle>
            <PresenceIndicator users={onlineUsers} />
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!appointmentId && !defaultServiceOrderId && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Service Order</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateNewServiceOrder(!createNewServiceOrder)}
                >
                  {createNewServiceOrder ? "Select Existing" : "Create New"}
                </Button>
              </div>

              {createNewServiceOrder ? (
                <>
                  <FieldPresenceWrapper fieldName="so_customer_id" onlineUsers={onlineUsers}>
                    <div className="space-y-2">
                      <Label htmlFor="so_customer_id">Customer *</Label>
                      <Select 
                        value={serviceOrderData.customer_id} 
                        onValueChange={(value) => {
                          setServiceOrderData({ ...serviceOrderData, customer_id: value });
                          setCurrentField("so_customer_id");
                          updateField("so_customer_id");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="so_title" onlineUsers={onlineUsers}>
                    <div className="space-y-2">
                      <Label htmlFor="so_title">Service Order Title *</Label>
                      <Input
                        id="so_title"
                        value={serviceOrderData.title}
                        onChange={(e) => setServiceOrderData({ ...serviceOrderData, title: e.target.value })}
                        onFocus={() => {
                          setCurrentField("so_title");
                          updateField("so_title");
                        }}
                        placeholder="e.g., HVAC Maintenance"
                        required
                      />
                    </div>
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="so_description" onlineUsers={onlineUsers}>
                    <div className="space-y-2">
                      <Label htmlFor="so_description">Service Order Description</Label>
                      <Textarea
                        id="so_description"
                        value={serviceOrderData.description}
                        onChange={(e) => setServiceOrderData({ ...serviceOrderData, description: e.target.value })}
                        onFocus={() => {
                          setCurrentField("so_description");
                          updateField("so_description");
                        }}
                        rows={2}
                        placeholder="Details about the service order"
                      />
                    </div>
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="so_priority" onlineUsers={onlineUsers}>
                    <div className="space-y-2">
                      <Label htmlFor="so_priority">Priority</Label>
                      <Select 
                        value={serviceOrderData.priority} 
                        onValueChange={(value) => {
                          setServiceOrderData({ ...serviceOrderData, priority: value });
                          setCurrentField("so_priority");
                          updateField("so_priority");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </FieldPresenceWrapper>
                </>
              ) : (
                <FieldPresenceWrapper fieldName="service_order_id" onlineUsers={onlineUsers}>
                  <div className="space-y-2">
                    <Label htmlFor="service_order_id">Select Service Order *</Label>
                    <Select 
                      value={formData.service_order_id} 
                      onValueChange={(value) => {
                        setFormData({ ...formData, service_order_id: value });
                        setCurrentField("service_order_id");
                        updateField("service_order_id");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service order" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.order_number} - {order.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FieldPresenceWrapper>
              )}
            </div>
          )}

          {(appointmentId || defaultServiceOrderId) && (
            <FieldPresenceWrapper fieldName="service_order_id" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="service_order_id">Service Order</Label>
                <Select 
                  value={formData.service_order_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, service_order_id: value });
                    setCurrentField("service_order_id");
                    updateField("service_order_id");
                  }}
                  disabled={!!defaultServiceOrderId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Link to service order" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_number} - {order.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldPresenceWrapper>
          )}

          <FieldPresenceWrapper fieldName="title" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onFocus={() => {
                  setCurrentField("title");
                  updateField("title");
                }}
                required
              />
            </div>
          </FieldPresenceWrapper>

          <FieldPresenceWrapper fieldName="description" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                onFocus={() => {
                  setCurrentField("description");
                  updateField("description");
                }}
                rows={2}
              />
            </div>
          </FieldPresenceWrapper>

          <div className="grid grid-cols-2 gap-4">
            <FieldPresenceWrapper fieldName="start_time" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  onFocus={() => {
                    setCurrentField("start_time");
                    updateField("start_time");
                  }}
                  required
                />
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="end_time" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time *</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  onFocus={() => {
                    setCurrentField("end_time");
                    updateField("end_time");
                  }}
                  required
                />
              </div>
            </FieldPresenceWrapper>
          </div>

          <FieldPresenceWrapper fieldName="assigned_to" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select 
                value={formData.assigned_to} 
                onValueChange={(value) => {
                  setFormData({ ...formData, assigned_to: value });
                  setCurrentField("assigned_to");
                  updateField("assigned_to");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.first_name} {tech.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FieldPresenceWrapper>

          {formData.service_order_id && (
            <WorkerSuggestions
              serviceOrderId={formData.service_order_id}
              onSelectWorker={(workerId) => {
                setFormData({ ...formData, assigned_to: workerId });
                setCurrentField("assigned_to");
                updateField("assigned_to");
              }}
              selectedWorkerId={formData.assigned_to}
            />
          )}

          {appointmentId && (
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
              <Label className="text-base font-semibold">Assigned Workers</Label>
              
              <div className="space-y-2">
                {assignedWorkers.map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between p-2 bg-background rounded-md border">
                    <span className="text-sm">
                      {worker.first_name} {worker.last_name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAssignedWorkers(assignedWorkers.filter(w => w.id !== worker.id));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                
                {assignedWorkers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No workers assigned</p>
                )}
              </div>

              <Select
                value=""
                onValueChange={(workerId) => {
                  const worker = technicians.find(t => t.id === workerId);
                  if (worker && !assignedWorkers.find(w => w.id === workerId)) {
                    setAssignedWorkers([...assignedWorkers, worker]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add worker" />
                </SelectTrigger>
                <SelectContent>
                  {technicians
                    .filter(tech => !assignedWorkers.find(w => w.id === tech.id))
                    .map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <FieldPresenceWrapper fieldName="status" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => {
                  setFormData({ ...formData, status: value });
                  setCurrentField("status");
                  updateField("status");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldPresenceWrapper>

          <div className="space-y-4 p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">GPS Location</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetCurrentLocation}
                className="gap-2"
              >
                <MapPin className="h-4 w-4" />
                Get Current Location
              </Button>
            </div>

            <FieldPresenceWrapper fieldName="location_address" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="location_address">Address</Label>
                <AddressAutocomplete
                  value={formData.location_address}
                  onChange={(value) => {
                    setFormData({ ...formData, location_address: value });
                  }}
                  onPlaceSelect={(place) => {
                    setFormData({
                      ...formData,
                      location_address: place.address,
                      location_lat: place.latitude.toString(),
                      location_lng: place.longitude.toString(),
                    });
                    setCurrentField("location_address");
                    updateField("location_address");
                  }}
                  placeholder="Start typing to search address..."
                />
              </div>
            </FieldPresenceWrapper>

            <div className="grid grid-cols-2 gap-4">
              <FieldPresenceWrapper fieldName="location_lat" onlineUsers={onlineUsers}>
                <div className="space-y-2">
                  <Label htmlFor="location_lat">Latitude</Label>
                  <Input
                    id="location_lat"
                    type="number"
                    step="0.000001"
                    value={formData.location_lat}
                    onChange={(e) => setFormData({ ...formData, location_lat: e.target.value })}
                    onFocus={() => {
                      setCurrentField("location_lat");
                      updateField("location_lat");
                    }}
                    placeholder="-33.8688"
                  />
                </div>
              </FieldPresenceWrapper>

              <FieldPresenceWrapper fieldName="location_lng" onlineUsers={onlineUsers}>
                <div className="space-y-2">
                  <Label htmlFor="location_lng">Longitude</Label>
                  <Input
                    id="location_lng"
                    type="number"
                    step="0.000001"
                    value={formData.location_lng}
                    onChange={(e) => setFormData({ ...formData, location_lng: e.target.value })}
                    onFocus={() => {
                      setCurrentField("location_lng");
                      updateField("location_lng");
                    }}
                    placeholder="151.2093"
                  />
                </div>
              </FieldPresenceWrapper>
            </div>

            <FieldPresenceWrapper fieldName="gps_check_in_radius" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="gps_check_in_radius">Check-in Radius (meters)</Label>
                <Input
                  id="gps_check_in_radius"
                  type="number"
                  value={formData.gps_check_in_radius}
                  onChange={(e) => setFormData({ ...formData, gps_check_in_radius: e.target.value })}
                  onFocus={() => {
                    setCurrentField("gps_check_in_radius");
                    updateField("gps_check_in_radius");
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Technician must be within this radius to check in
                </p>
              </div>
            </FieldPresenceWrapper>
          </div>

          <FieldPresenceWrapper fieldName="notes" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                onFocus={() => {
                  setCurrentField("notes");
                  updateField("notes");
                }}
                rows={2}
              />
            </div>
          </FieldPresenceWrapper>

          {!appointmentId && (
            <div className="space-y-2">
              <Label>Recurrence</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRecurrenceDialog(true)}
                className="w-full justify-start gap-2"
              >
                <Repeat className="h-4 w-4" />
                {recurrenceConfig ? (
                  <div className="flex items-center gap-2">
                    <span>Repeats {recurrenceConfig.pattern}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {recurrenceConfig.frequency > 1 && `Every ${recurrenceConfig.frequency} `}
                      {recurrenceConfig.pattern}
                    </Badge>
                  </div>
                ) : (
                  "Does not repeat"
                )}
              </Button>
            </div>
          )}

          {(isRecurring || parentAppointmentId) && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Repeat className="h-4 w-4" />
                <span className="font-medium">This is a recurring appointment</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Changes will affect this appointment only unless you choose to edit the series
              </p>
            </div>
          )}

          <div className="flex items-end gap-2">
            {appointmentId && (
              <CreateTaskButton
                linkedModule="appointment"
                linkedRecordId={appointmentId}
                variant="outline"
                size="default"
              />
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowSaveTemplateDialog(true)}>
              Save as Template
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {appointmentId ? "Update" : "Create"} Appointment
            </Button>
          </div>
        </form>
      </DialogContent>

      <RecurrenceDialog
        open={showRecurrenceDialog}
        onOpenChange={setShowRecurrenceDialog}
        onSave={setRecurrenceConfig}
        initialConfig={recurrenceConfig}
      />

      <RecurringEditDialog
        open={showRecurringEditDialog}
        onOpenChange={setShowRecurringEditDialog}
        onConfirm={saveAppointment}
        action="edit"
      />

      <SaveTemplateDialog
        open={showSaveTemplateDialog}
        onOpenChange={setShowSaveTemplateDialog}
        appointmentData={formData}
        type="appointment"
      />
    </Dialog>
  );
}