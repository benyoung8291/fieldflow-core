import { useState, useMemo } from "react";
import { useLogDetailPageAccess } from "@/hooks/useLogDetailPageAccess";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Upload, 
  Download, 
  Trash2, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  FileText, 
  Send, 
  UserPlus, 
  X,
  Edit3,
  Check,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  Paperclip,
  Image as ImageIcon,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import TimeLogsTable from "@/components/service-orders/TimeLogsTable";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import { usePermissions } from "@/hooks/usePermissions";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/customers/AddressAutocomplete";
import FieldReportsList from "@/components/field-reports/FieldReportsList";
import { DocumentNotes } from "@/components/notes/DocumentNotes";
import { AppointmentAttachments } from "@/components/appointments/AppointmentAttachments";
import { CreateTimeLogDialog } from "@/components/appointments/CreateTimeLogDialog";
import { usePresenceSystem } from "@/hooks/usePresenceSystem";
import { useAssignableWorkers } from "@/hooks/useAssignableWorkers";
import { useSubcontractorWorkers } from "@/hooks/useSubcontractorWorkers";

const statusColors = {
  draft: "bg-muted text-muted-foreground border-muted",
  published: "bg-info/10 text-info border-info/20",
  checked_in: "bg-warning/10 text-warning border-warning/20",
  completed: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels = {
  draft: "Draft",
  published: "Published",
  checked_in: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function AppointmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, userRoles, hasPermission } = usePermissions();
  const { isMobile } = useViewMode();
  const isSupervisorOrAdmin = isAdmin || userRoles?.some((r) => r.role === "supervisor");
  const [editMode, setEditMode] = useState(false);
  const canEditAppointments = hasPermission("appointments", "edit");

  // Log data access for audit trail
  useLogDetailPageAccess('appointments', id);
  const [formData, setFormData] = useState({
    location_address: "",
  });
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [selectedWorkerToAdd, setSelectedWorkerToAdd] = useState("");
  const [createTimeLogOpen, setCreateTimeLogOpen] = useState(false);

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch appointment details with location state and subcontractor workers
  const { data: appointment, isLoading, refetch: refetchAppointment } = useQuery({
    queryKey: ["appointment", id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service_orders (
            id,
            work_order_number,
            order_number,
            title,
            customer_id,
            location_id,
            customer_locations!service_orders_location_id_fkey (
              state
            ),
            customers (
              name,
              email,
              phone
            )
          ),
          appointment_workers (
            id,
            worker_id,
            contact_id,
            profiles (
              id,
              first_name,
              last_name,
              email,
              phone,
              worker_state
            ),
            contacts (
              id,
              first_name,
              last_name,
              email,
              phone,
              worker_state,
              suppliers (
                id,
                name
              )
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Track presence on this appointment
  usePresenceSystem({
    trackPresence: true,
    documentId: id,
    documentType: "appointments",
    documentName: appointment?.title ? `Appointment: ${appointment.title}` : undefined,
  });

  // Fetch assignable workers (internal workers with 'worker' role only)
  const { data: internalWorkers = [] } = useAssignableWorkers();
  
  // Fetch subcontractor workers
  const { data: subcontractorWorkers = [] } = useSubcontractorWorkers();
  
  // Get appointment location state
  const appointmentLocationState = appointment?.service_orders?.customer_locations?.state || null;

  // Get assigned worker/contact IDs (needed before early returns for useMemo)
  const assignedWorkers = appointment?.appointment_workers || [];
  const assignedWorkerIds = assignedWorkers.filter((aw: any) => aw.worker_id).map((aw: any) => aw.worker_id);
  const assignedContactIds = assignedWorkers.filter((aw: any) => aw.contact_id).map((aw: any) => aw.contact_id);

  // Build sorted list of available workers - MUST be before early returns
  const sortedAvailableWorkers = useMemo(() => {
    const sameStateWorkers = internalWorkers.filter(
      w => !assignedWorkerIds.includes(w.id) && appointmentLocationState && w.worker_state === appointmentLocationState
    );
    const otherStateWorkers = internalWorkers.filter(
      w => !assignedWorkerIds.includes(w.id) && (!appointmentLocationState || w.worker_state !== appointmentLocationState)
    );
    const availableSubcontractors = subcontractorWorkers.filter(
      s => !assignedContactIds.includes(s.id)
    );

    type SortedWorker = {
      id: string;
      first_name: string;
      last_name: string;
      worker_state: string | null;
      type: 'sameState' | 'other' | 'subcontractor';
      isSubcontractor: boolean;
      supplier_name?: string;
    };

    const result: SortedWorker[] = [
      ...sameStateWorkers.map(w => ({ id: w.id, first_name: w.first_name, last_name: w.last_name, worker_state: w.worker_state, type: 'sameState' as const, isSubcontractor: false })),
      ...otherStateWorkers.map(w => ({ id: w.id, first_name: w.first_name, last_name: w.last_name, worker_state: w.worker_state, type: 'other' as const, isSubcontractor: false })),
      ...availableSubcontractors.map(s => ({ id: s.id, first_name: s.first_name, last_name: s.last_name, worker_state: s.worker_state, type: 'subcontractor' as const, isSubcontractor: true, supplier_name: s.supplier_name })),
    ];

    return result;
  }, [internalWorkers, subcontractorWorkers, assignedWorkerIds, assignedContactIds, appointmentLocationState]);

  // Fetch field reports
  const { data: fieldReports = [] } = useQuery({
    queryKey: ['field-reports', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_reports')
        .select('id, status, created_by, approved_at, pdf_url')
        .eq('appointment_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Add worker mutation - handles both internal workers and subcontractors
  const addWorkerMutation = useMutation({
    mutationFn: async ({ workerId, contactId }: { workerId?: string; contactId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const insertData: any = {
        appointment_id: id,
        tenant_id: profile?.tenant_id
      };

      if (workerId) {
        insertData.worker_id = workerId;
      } else if (contactId) {
        insertData.contact_id = contactId;
      } else {
        throw new Error('Either workerId or contactId must be provided');
      }

      const { error } = await supabase
        .from('appointment_workers')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      setShowAddWorker(false);
      setSelectedWorkerToAdd("");
      toast.success('Worker assigned successfully');
    },
    onError: () => {
      toast.error('Failed to assign worker');
    }
  });

  // Remove worker mutation - handles both internal workers and subcontractors
  const removeWorkerMutation = useMutation({
    mutationFn: async ({ workerId, contactId }: { workerId?: string | null; contactId?: string | null }) => {
      let deleteQuery = supabase
        .from('appointment_workers')
        .delete()
        .eq('appointment_id', id!);
      
      if (workerId) {
        deleteQuery = deleteQuery.eq('worker_id', workerId);
      } else if (contactId) {
        deleteQuery = deleteQuery.eq('contact_id', contactId);
      } else {
        throw new Error('Either workerId or contactId must be provided');
      }

      const { error } = await deleteQuery;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      toast.success('Worker removed successfully');
    },
    onError: () => {
      toast.error('Failed to remove worker');
    }
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment", id] });
      toast.success("Appointment updated");
      setEditMode(false);
    },
    onError: () => {
      toast.error("Failed to update appointment");
    },
  });

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataFromEvent = new FormData(e.currentTarget);
    updateAppointmentMutation.mutate({
      title: formDataFromEvent.get("title"),
      description: formDataFromEvent.get("description"),
      notes: formDataFromEvent.get("notes"),
      status: formDataFromEvent.get("status"),
      location_address: formData.location_address || appointment?.location_address,
    });
  };

  const handleCreateFieldReport = () => {
    const userReport = fieldReports.find(r => r.created_by === currentUser?.id);
    
    if (userReport && !userReport.approved_at && !userReport.pdf_url) {
      navigate(`/worker/field-report/${id}/edit/${userReport.id}`);
    } else {
      navigate(`/worker/field-report/${id}`);
    }
  };

  const getFieldReportButtonText = () => {
    const userReport = fieldReports.find(r => r.created_by === currentUser?.id);
    
    if (!userReport) return "Create Field Report";
    if (userReport.status === 'draft') return "Continue Field Report";
    if (userReport.status === 'submitted' && !userReport.approved_at) return "Edit Report";
    return "View Field Report";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading appointment...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Appointment Not Found</h3>
            <p className="text-sm text-muted-foreground">This appointment may have been deleted or doesn't exist.</p>
            <Button onClick={() => navigate("/appointments")} variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Appointments
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }


  // MOBILE LAYOUT
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background pb-20">
          {/* Mobile Header - Fixed */}
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b">
            <div className="flex items-center gap-3 p-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/appointments")}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold truncate">{appointment.title}</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {format(new Date(appointment.start_time), "MMM d, yyyy")}
                </p>
              </div>
              <Badge
                className={cn(
                  "shrink-0 text-xs font-medium border",
                  statusColors[appointment.status as keyof typeof statusColors]
                )}
              >
                {statusLabels[appointment.status as keyof typeof statusLabels]}
              </Badge>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
              {appointment.status === 'draft' && canEditAppointments && (
                <Button
                  size="sm"
                  onClick={() => updateAppointmentMutation.mutate({ status: 'published' })}
                  disabled={updateAppointmentMutation.isPending}
                  className="shrink-0"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Publish
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreateFieldReport}
                className="shrink-0"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                {getFieldReportButtonText()}
              </Button>
            </div>
          </div>

          {/* Mobile Content */}
          <div className="p-4 space-y-4">
            {/* Hero Info Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-4 space-y-4">
                {/* Time & Location */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Time</span>
                    </div>
                    <p className="text-sm font-medium">
                      {format(new Date(appointment.start_time), "h:mm a")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(appointment.end_time), "h:mm a")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Date</span>
                    </div>
                    <p className="text-sm font-medium">
                      {format(new Date(appointment.start_time), "MMM d")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(appointment.start_time), "yyyy")}
                    </p>
                  </div>
                </div>

                {appointment.location_address && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Location</span>
                      </div>
                      <p className="text-sm">{appointment.location_address}</p>
                    </div>
                  </>
                )}

                {appointment.description && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Description</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{appointment.description}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Service Order Link */}
            {appointment.service_orders && (
              <Link to={`/service-orders/${appointment.service_orders.id}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Service Order</p>
                        <p className="text-sm font-semibold truncate">
                          {appointment.service_orders.work_order_number || appointment.service_orders.order_number}
                        </p>
                        {appointment.service_orders.customers && (
                          <p className="text-xs text-muted-foreground truncate">
                            {appointment.service_orders.customers.name}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Assigned Workers */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Team Members</span>
                    <Badge variant="secondary" className="text-xs">
                      {assignedWorkers.length}
                    </Badge>
                  </div>
                  {isSupervisorOrAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddWorker(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {showAddWorker && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <Select value={selectedWorkerToAdd} onValueChange={setSelectedWorkerToAdd}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select worker..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedAvailableWorkers.map((worker) => (
                          <SelectItem 
                            key={worker.id} 
                            value={`${worker.isSubcontractor ? 'sub:' : 'worker:'}${worker.id}`}
                            className={cn(
                              worker.type === 'sameState' && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30",
                              worker.type === 'subcontractor' && "ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-950/30"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>{worker.first_name} {worker.last_name}</span>
                              {worker.isSubcontractor && (
                                <span className="text-xs text-violet-600 dark:text-violet-400">({worker.supplier_name})</span>
                              )}
                              {worker.worker_state && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">{worker.worker_state}</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedWorkerToAdd) {
                            const [type, workerId] = selectedWorkerToAdd.split(':');
                            if (type === 'sub') {
                              addWorkerMutation.mutate({ contactId: workerId });
                            } else {
                              addWorkerMutation.mutate({ workerId });
                            }
                          }
                        }}
                        disabled={!selectedWorkerToAdd || addWorkerMutation.isPending}
                        className="flex-1"
                      >
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddWorker(false);
                          setSelectedWorkerToAdd("");
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {assignedWorkers.length === 0 ? (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No workers assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedWorkers.map((aw: any) => {
                      const isSubcontractor = !aw.worker_id && aw.contact_id;
                      const workerData = isSubcontractor ? aw.contacts : aw.profiles;
                      if (!workerData) return null;
                      
                      const isSameState = !isSubcontractor && appointmentLocationState && workerData.worker_state === appointmentLocationState;
                      
                      return (
                        <div 
                          key={aw.id} 
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg",
                            isSubcontractor ? "bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-800" :
                            isSameState ? "bg-green-50 ring-2 ring-green-200 dark:bg-green-950/30 dark:ring-green-800" :
                            "bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                            isSubcontractor ? "bg-violet-200 dark:bg-violet-900" : "bg-primary/20"
                          )}>
                            <span className={cn(
                              "text-xs font-semibold",
                              isSubcontractor ? "text-violet-700 dark:text-violet-300" : "text-primary"
                            )}>
                              {workerData.first_name?.[0]}{workerData.last_name?.[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">
                                {workerData.first_name} {workerData.last_name}
                              </p>
                              {isSubcontractor && aw.contacts?.suppliers?.name && (
                                <span className="text-xs text-violet-600 dark:text-violet-400">({aw.contacts.suppliers.name})</span>
                              )}
                            </div>
                            {workerData.email && (
                              <p className="text-xs text-muted-foreground truncate">{workerData.email}</p>
                            )}
                          </div>
                          {isSupervisorOrAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => removeWorkerMutation.mutate({ 
                                workerId: aw.worker_id, 
                                contactId: aw.contact_id 
                              })}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Before Photos */}
            <AppointmentAttachments 
              appointmentId={id!}
              category="before_photo"
              title="Before Photos"
              description="Upload photos that will be used as 'before' images in field reports"
            />

            {/* Documents */}
            <AppointmentAttachments 
              appointmentId={id!}
              category="document"
              title="Documents"
              description="Upload relevant documents for technicians completing this appointment"
            />

            {/* Time Logs */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Time Logs</span>
                  </div>
                  {isSupervisorOrAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreateTimeLogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create
                    </Button>
                  )}
                </div>
                <TimeLogsTable appointmentId={id!} />
              </CardContent>
            </Card>

            <CreateTimeLogDialog
              appointmentId={id!}
              open={createTimeLogOpen}
              onOpenChange={setCreateTimeLogOpen}
            />

            {/* Field Reports */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Field Reports</span>
                </div>
                <FieldReportsList appointmentId={id!} onReportStateChange={refetchAppointment} />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Notes</span>
                </div>
                <DocumentNotes documentType="appointment" documentId={id!} />
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Tasks</span>
                  </div>
                  <CreateTaskButton
                    linkedModule="appointment"
                    linkedRecordId={id!}
                  />
                </div>
                <LinkedTasksList
                  linkedModule="appointment"
                  linkedRecordId={id!}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // DESKTOP LAYOUT
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/appointments")}
              className="shrink-0 mt-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold tracking-tight truncate">{appointment.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge
                  className={cn(
                    "text-sm font-medium border",
                    statusColors[appointment.status as keyof typeof statusColors]
                  )}
                >
                  {statusLabels[appointment.status as keyof typeof statusLabels]}
                </Badge>
                {appointment.appointment_number && (
                  <span className="text-sm text-muted-foreground font-mono">
                    {appointment.appointment_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {appointment.status === 'draft' && (
              <Button
                onClick={() => updateAppointmentMutation.mutate({ status: 'published' })}
                disabled={updateAppointmentMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Publish
              </Button>
            )}
            {!editMode ? (
              <Button variant="outline" onClick={() => setEditMode(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Info Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                {editMode ? (
                  <form onSubmit={handleFormSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                      <Input 
                        id="title" 
                        name="title" 
                        defaultValue={appointment.title} 
                        required 
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                      <Textarea 
                        id="description" 
                        name="description" 
                        defaultValue={appointment.description || ""} 
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                        <Select name="status" defaultValue={appointment.status}>
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="checked_in">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Duration</Label>
                        <div className="h-11 flex items-center px-3 border rounded-md bg-muted/50 text-sm">
                          {format(new Date(appointment.start_time), "h:mm a")} - {format(new Date(appointment.end_time), "h:mm a")}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location_address" className="text-sm font-medium">Location</Label>
                      <AddressAutocomplete
                        value={formData.location_address || appointment.location_address || ""}
                        onChange={(value) => setFormData({ ...formData, location_address: value })}
                        onPlaceSelect={(place) => setFormData({
                          ...formData,
                          location_address: place.address,
                        })}
                        placeholder="Start typing to search address..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                      <Textarea 
                        id="notes" 
                        name="notes" 
                        defaultValue={appointment.notes || ""} 
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button 
                        type="submit" 
                        disabled={updateAppointmentMutation.isPending}
                        className="min-w-[120px]"
                      >
                        {updateAppointmentMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setEditMode(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    {/* Time & Date Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Date</span>
                        </div>
                        <p className="text-lg font-semibold">
                          {format(new Date(appointment.start_time), "MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(appointment.start_time), "EEEE")}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Start</span>
                        </div>
                        <p className="text-lg font-semibold">
                          {format(new Date(appointment.start_time), "h:mm a")}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">End</span>
                        </div>
                        <p className="text-lg font-semibold">
                          {format(new Date(appointment.end_time), "h:mm a")}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Location */}
                    {appointment.location_address && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Location</span>
                          </div>
                          <p className="text-sm leading-relaxed">{appointment.location_address}</p>
                        </div>
                        <Separator />
                      </>
                    )}

                    {/* Description */}
                    {appointment.description && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">Description</span>
                          </div>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {appointment.description}
                          </p>
                        </div>
                        <Separator />
                      </>
                    )}

                    {/* Notes */}
                    {appointment.notes && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Notes</span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {appointment.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Order Info */}
            {appointment.service_orders && (
              <Link to={`/service-orders/${appointment.service_orders.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Service Order
                        </p>
                        <p className="text-lg font-semibold truncate mb-1">
                          {appointment.service_orders.work_order_number || appointment.service_orders.order_number}
                        </p>
                        {appointment.service_orders.title && (
                          <p className="text-sm text-muted-foreground truncate">
                            {appointment.service_orders.title}
                          </p>
                        )}
                        {appointment.service_orders.customers && (
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <span className="text-muted-foreground">Customer:</span>
                            <span className="font-medium">{appointment.service_orders.customers.name}</span>
                          </div>
                        )}
                      </div>
                      <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Before Photos */}
            <AppointmentAttachments 
              appointmentId={id!}
              category="before_photo"
              title="Before Photos"
              description="Upload photos that will be used as 'before' images in field reports"
            />

            {/* Documents */}
            <AppointmentAttachments 
              appointmentId={id!}
              category="document"
              title="Documents"
              description="Upload relevant documents for technicians completing this appointment"
            />

            {/* Time Logs */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Time Logs</h3>
                  </div>
                  {isSupervisorOrAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreateTimeLogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Time Log
                    </Button>
                  )}
                </div>
                <TimeLogsTable appointmentId={id!} />
              </CardContent>
            </Card>

            <CreateTimeLogDialog
              appointmentId={id!}
              open={createTimeLogOpen}
              onOpenChange={setCreateTimeLogOpen}
            />

            {/* Notes */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Notes</h3>
                </div>
                <DocumentNotes documentType="appointment" documentId={id!} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Assigned Workers */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Team</h3>
                    <Badge variant="secondary">{assignedWorkers.length}</Badge>
                  </div>
                  {isSupervisorOrAdmin && !showAddWorker && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddWorker(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  )}
                </div>

                {showAddWorker && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <Select value={selectedWorkerToAdd} onValueChange={setSelectedWorkerToAdd}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select worker..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedAvailableWorkers.map((worker) => (
                          <SelectItem 
                            key={worker.id} 
                            value={`${worker.isSubcontractor ? 'sub:' : 'worker:'}${worker.id}`}
                            className={cn(
                              worker.type === 'sameState' && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30",
                              worker.type === 'subcontractor' && "ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-950/30"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>{worker.first_name} {worker.last_name}</span>
                              {worker.isSubcontractor && worker.supplier_name && (
                                <span className="text-xs text-violet-600 dark:text-violet-400">({worker.supplier_name})</span>
                              )}
                              {worker.worker_state && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">{worker.worker_state}</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedWorkerToAdd) {
                            const [type, workerId] = selectedWorkerToAdd.split(':');
                            if (type === 'sub') {
                              addWorkerMutation.mutate({ contactId: workerId });
                            } else {
                              addWorkerMutation.mutate({ workerId });
                            }
                          }
                        }}
                        disabled={!selectedWorkerToAdd || addWorkerMutation.isPending}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Add Worker
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddWorker(false);
                          setSelectedWorkerToAdd("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {assignedWorkers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No workers assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignedWorkers.map((aw: any) => {
                      const isSubcontractor = !aw.worker_id && aw.contact_id;
                      const workerData = isSubcontractor ? aw.contacts : aw.profiles;
                      if (!workerData) return null;
                      
                      const isSameState = !isSubcontractor && appointmentLocationState && workerData.worker_state === appointmentLocationState;
                      
                      return (
                        <div
                          key={aw.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-colors group",
                            isSubcontractor ? "bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-800" :
                            isSameState ? "bg-green-50 ring-2 ring-green-200 dark:bg-green-950/30 dark:ring-green-800 hover:bg-green-100 dark:hover:bg-green-950/50" :
                            "bg-muted/30 hover:bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                            isSubcontractor ? "bg-violet-200 dark:bg-violet-900" : "bg-primary/20"
                          )}>
                            <span className={cn(
                              "text-sm font-semibold",
                              isSubcontractor ? "text-violet-700 dark:text-violet-300" : "text-primary"
                            )}>
                              {workerData.first_name?.[0]}{workerData.last_name?.[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">
                                {workerData.first_name} {workerData.last_name}
                              </p>
                              {isSubcontractor && aw.contacts?.suppliers?.name && (
                                <span className="text-xs text-violet-600 dark:text-violet-400">({aw.contacts.suppliers.name})</span>
                              )}
                            </div>
                            {workerData.email && (
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                                <Mail className="h-3 w-3" />
                                {workerData.email}
                              </p>
                            )}
                            {workerData.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <Phone className="h-3 w-3" />
                                {workerData.phone}
                              </p>
                            )}
                          </div>
                          {isSupervisorOrAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeWorkerMutation.mutate({ 
                                workerId: aw.worker_id, 
                                contactId: aw.contact_id 
                              })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Field Reports */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Field Reports</h3>
                </div>
                <Button
                  onClick={handleCreateFieldReport}
                  className="w-full"
                  variant="outline"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {getFieldReportButtonText()}
                </Button>
                <FieldReportsList 
                  appointmentId={id!} 
                  onReportStateChange={refetchAppointment} 
                />
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Tasks</h3>
                  </div>
                  <CreateTaskButton
                    linkedModule="appointment"
                    linkedRecordId={id!}
                  />
                </div>
                <LinkedTasksList
                  linkedModule="appointment"
                  linkedRecordId={id!}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
