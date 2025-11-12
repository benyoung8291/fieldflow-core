import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInHours, differenceInMinutes, formatDistanceToNow, isToday, isYesterday, isThisYear } from "date-fns";
import { Calendar, Clock, MapPin, User, Users, FileText, Repeat, Edit, Trash2, History, UserPlus, UserMinus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppointmentDetailsDialogProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export default function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: AppointmentDetailsDialogProps) {
  if (!appointment) return null;

  const startTime = new Date(appointment.start_time);
  const endTime = new Date(appointment.end_time);
  const hours = differenceInHours(endTime, startTime);
  const minutes = differenceInMinutes(endTime, startTime) % 60;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-muted";
      case "published": return "bg-info";
      case "checked_in": return "bg-warning";
      case "completed": return "bg-success";
      case "cancelled": return "bg-destructive";
      default: return "bg-muted";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const workers = appointment.appointment_workers || [];
  
  type TimeLogWithWorker = {
    id: string;
    clock_in: string;
    clock_out: string | null;
    total_hours: number | null;
    notes: string | null;
    worker_id: string;
    appointment_id: string;
    worker?: {
      id: string;
      first_name: string | null;
      last_name: string | null;
    } | null;
  };
  
  const { logs } = useAuditLog("appointments", appointment.id);

  // Fetch time logs for this appointment
  const { data: timeLogs = [] } = useQuery<TimeLogWithWorker[]>({
    queryKey: ["time-logs", appointment.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*")
        .eq("appointment_id", appointment.id)
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      
      // Fetch worker names separately
      if (data && data.length > 0) {
        const workerIds = [...new Set(data.map(log => log.worker_id))];
        const { data: workers } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", workerIds);
        
        const workerMap = new Map(workers?.map(w => [w.id, w]) || []);
        return data.map(log => ({
          ...log,
          worker: workerMap.get(log.worker_id) || null,
        }));
      }
      
      return data || [];
    },
  });

  // Fetch worker assignment audit logs
  const { data: workerAuditLogs = [] } = useQuery({
    queryKey: ["worker-audit-logs", appointment.id],
    queryFn: async () => {
      // Query audit logs for appointment_workers table
      const { data: auditLogs, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "appointment_workers")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching worker audit logs:", error);
        return [];
      }

      if (!auditLogs || auditLogs.length === 0) return [];
      
      // Filter logs to only include those related to this appointment
      const relevantLogs = auditLogs.filter(log => {
        try {
          const newValue = log.new_value ? JSON.parse(log.new_value) : null;
          const oldValue = log.old_value ? JSON.parse(log.old_value) : null;
          const appointmentId = newValue?.appointment_id || oldValue?.appointment_id;
          return appointmentId === appointment.id;
        } catch {
          return false;
        }
      });

      // Fetch worker names for the logs
      if (relevantLogs.length > 0) {
        const workerIds = relevantLogs
          .map(log => {
            try {
              const newValue = log.new_value ? JSON.parse(log.new_value) : null;
              const oldValue = log.old_value ? JSON.parse(log.old_value) : null;
              return newValue?.worker_id || oldValue?.worker_id;
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        
        if (workerIds.length === 0) return relevantLogs;

        const { data: workers } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", workerIds);
        
        const workerMap = new Map(workers?.map(w => [w.id, w]) || []);
        
        return relevantLogs.map(log => ({
          ...log,
          workerInfo: (() => {
            try {
              const newValue = log.new_value ? JSON.parse(log.new_value) : null;
              const oldValue = log.old_value ? JSON.parse(log.old_value) : null;
              const workerId = newValue?.worker_id || oldValue?.worker_id;
              return workerMap.get(workerId);
            } catch {
              return null;
            }
          })(),
        }));
      }
      
      return relevantLogs;
    },
  });

  // Format timestamp in human-readable format
  const formatTimestamp = (timestamp: Date) => {
    if (isToday(timestamp)) {
      return `Today at ${format(timestamp, "h:mm a")}`;
    } else if (isYesterday(timestamp)) {
      return `Yesterday at ${format(timestamp, "h:mm a")}`;
    } else if (isThisYear(timestamp)) {
      return format(timestamp, "MMM d 'at' h:mm a");
    } else {
      return format(timestamp, "MMM d, yyyy 'at' h:mm a");
    }
  };

  // Combine audit logs, time logs, and worker audit logs into a single timeline
  const timelineItems = [
    ...logs.map(log => ({
      type: "audit" as const,
      timestamp: new Date(log.created_at),
      data: log,
    })),
    ...timeLogs.map(log => ({
      type: "time_log" as const,
      timestamp: new Date(log.clock_in),
      data: log,
    })),
    ...workerAuditLogs.map((log: any) => ({
      type: "worker_audit" as const,
      timestamp: new Date(log.created_at),
      data: log,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">
                {appointment.title}
              </DialogTitle>
              <Badge className={getStatusColor(appointment.status)}>
                {getStatusLabel(appointment.status)}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              {onDelete && (
                <Button variant="outline" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 space-y-6">
          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Date:</span>
              <span>{format(startTime, "EEEE, MMMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Time:</span>
              <span>
                {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                <span className="text-muted-foreground ml-2">
                  ({hours}h {minutes > 0 ? `${minutes}m` : ''})
                </span>
              </span>
            </div>
            {(appointment.is_recurring || appointment.parent_appointment_id) && (
              <div className="flex items-center gap-2 text-sm">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Recurring</span>
                {appointment.recurrence_pattern && (
                  <Badge variant="outline" className="text-xs">
                    {appointment.recurrence_pattern}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Workers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                Assigned Workers ({workers.length})
              </span>
            </div>
            {workers.length > 0 ? (
              <div className="space-y-2">
                {workers.map((worker: any) => (
                  <div key={worker.worker_id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {worker.profiles?.first_name?.[0]}{worker.profiles?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {worker.profiles?.first_name} {worker.profiles?.last_name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No workers assigned</p>
            )}
          </div>

          {/* Location */}
          {appointment.location_address && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Location</span>
                </div>
                <p className="text-sm pl-6">{appointment.location_address}</p>
                {appointment.check_in_time && (
                  <p className="text-sm text-muted-foreground pl-6 mt-1">
                    Checked in at {format(new Date(appointment.check_in_time), "h:mm a")}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Service Order */}
          {appointment.service_orders && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Service Order</span>
                </div>
                <div className="pl-6">
                  <Badge variant="outline">{appointment.service_orders.order_number}</Badge>
                  {appointment.service_orders.title && (
                    <p className="text-sm mt-1">{appointment.service_orders.title}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Description */}
          {appointment.description && (
            <>
              <Separator />
              <div>
                <span className="font-medium text-sm block mb-2">Description</span>
                <p className="text-sm text-muted-foreground">{appointment.description}</p>
              </div>
            </>
          )}

          {/* Notes */}
          {appointment.notes && (
            <>
              <Separator />
              <div>
                <span className="font-medium text-sm block mb-2">Notes</span>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            </>
          )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-4">
              {timelineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No history available
                </p>
              ) : (
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                  
                  {timelineItems.map((item, index) => (
                    <div key={`${item.type}-${index}`} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-[9px] top-2 w-3 h-3 rounded-full border-2 ${
                        item.type === "time_log" 
                          ? "bg-success border-success" 
                          : item.type === "worker_audit"
                          ? "bg-primary border-primary"
                          : "bg-info border-info"
                      }`} />
                      
                      <div className="bg-muted/50 rounded-lg p-4">
                        {item.type === "audit" ? (
                          <>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-sm font-medium">
                                  {item.data.action === "create" && "Created"}
                                  {item.data.action === "update" && item.data.field_name && `Updated ${item.data.field_name.replace(/_/g, " ")}`}
                                  {item.data.action === "delete" && "Deleted"}
                                  {item.data.action === "revert" && "Reverted change"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  by {item.data.user_name}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-muted-foreground whitespace-nowrap block">
                                  {formatTimestamp(item.timestamp)}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            {item.data.old_value && item.data.new_value && (
                              <div className="text-xs space-y-1">
                                <div className="flex gap-2">
                                  <span className="text-muted-foreground">From:</span>
                                  <span className="text-destructive line-through">{item.data.old_value}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-muted-foreground">To:</span>
                                  <span className="text-success">{item.data.new_value}</span>
                                </div>
                              </div>
                            )}
                            {item.data.note && (
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                {item.data.note}
                              </p>
                            )}
                          </>
                        ) : item.type === "worker_audit" ? (
                          <>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-sm font-medium flex items-center gap-2">
                                  {item.data.action === "create" ? (
                                    <>
                                      <UserPlus className="h-4 w-4 text-success" />
                                      Worker Added
                                    </>
                                  ) : (
                                    <>
                                      <UserMinus className="h-4 w-4 text-destructive" />
                                      Worker Removed
                                    </>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.data.workerInfo?.first_name} {item.data.workerInfo?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  by {item.data.user_name}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-muted-foreground whitespace-nowrap block">
                                  {formatTimestamp(item.timestamp)}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-sm font-medium flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  Time Log
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.data.worker?.first_name} {item.data.worker?.last_name}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-muted-foreground whitespace-nowrap block">
                                  {formatTimestamp(item.timestamp)}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Clock In:</span>
                                <span>{format(new Date(item.data.clock_in), "h:mm a")}</span>
                              </div>
                              {item.data.clock_out && (
                                <>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Clock Out:</span>
                                    <span>{format(new Date(item.data.clock_out), "h:mm a")}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-medium">
                                    <span className="text-muted-foreground">Total Hours:</span>
                                    <span>{item.data.total_hours?.toFixed(2)}h</span>
                                  </div>
                                </>
                              )}
                              {!item.data.clock_out && (
                                <Badge variant="outline" className="text-xs mt-1">Active</Badge>
                              )}
                            </div>
                            {item.data.notes && (
                              <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                                {item.data.notes}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
