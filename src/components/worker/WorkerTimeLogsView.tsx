import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { Clock, CheckCircle2, AlertCircle, Edit2, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface WorkerTimeLogsViewProps {
  appointmentId: string;
}

const statusConfig = {
  in_progress: {
    label: "In Progress",
    className: "bg-warning/20 text-warning border-warning/30",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    className: "bg-info/20 text-info border-info/30",
    icon: CheckCircle2,
  },
  approved: {
    label: "Approved",
    className: "bg-success/20 text-success border-success/30",
    icon: CheckCircle2,
  },
};

export default function WorkerTimeLogsView({ appointmentId }: WorkerTimeLogsViewProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ clock_in: string; clock_out: string }>({
    clock_in: "",
    clock_out: "",
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[WorkerTimeLogsView] Current user:', user?.id);
      return user;
    },
  });

  const { data: timeLogs = [], isLoading, refetch } = useQuery({
    queryKey: ["worker-time-logs", appointmentId, currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) {
        console.log('[WorkerTimeLogsView] No current user, skipping fetch');
        return [];
      }
      
      console.log('[WorkerTimeLogsView] Fetching time logs for user:', currentUser.id, 'appointment:', appointmentId);
      
      const { data, error } = await supabase
        .from("time_logs")
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("worker_id", currentUser.id)
        .order("clock_in", { ascending: false });

      if (error) {
        console.error('[WorkerTimeLogsView] Error fetching time logs:', error);
        throw error;
      }
      
      console.log('[WorkerTimeLogsView] Fetched time logs:', data);
      return data || [];
    },
    enabled: !!currentUser?.id,
  });

  // Set up realtime subscription for time logs
  useEffect(() => {
    if (!currentUser?.id) return;

    console.log('[WorkerTimeLogsView] Setting up realtime subscription');
    
    const channel = supabase
      .channel(`time_logs:${appointmentId}:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_logs',
          filter: `appointment_id=eq.${appointmentId}`,
        },
        (payload) => {
          console.log('[WorkerTimeLogsView] Realtime update:', payload);
          refetch();
        }
      )
      .subscribe((status) => {
        console.log('[WorkerTimeLogsView] Subscription status:', status);
      });

    return () => {
      console.log('[WorkerTimeLogsView] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [appointmentId, currentUser?.id, refetch]);

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setEditData({
      clock_in: format(parseISO(log.clock_in), "yyyy-MM-dd'T'HH:mm"),
      clock_out: log.clock_out ? format(parseISO(log.clock_out), "yyyy-MM-dd'T'HH:mm") : "",
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ clock_in: "", clock_out: "" });
  };

  const handleSaveEdit = async (logId: string) => {
    try {
      const { error } = await supabase
        .from("time_logs")
        .update({
          clock_in: new Date(editData.clock_in).toISOString(),
          clock_out: editData.clock_out ? new Date(editData.clock_out).toISOString() : null,
        })
        .eq("id", logId);

      if (error) throw error;

      toast.success("Time log updated successfully");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["worker-time-logs", appointmentId, currentUser?.id] });
    } catch (error) {
      console.error("Error updating time log:", error);
      toast.error("Failed to update time log");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin mr-2" />
        Loading your time logs...
      </div>
    );
  }

  if (timeLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No time logs recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide px-1">
        Your Time Logs
      </h3>
      
      {timeLogs.map((log) => {
        const statusInfo = statusConfig[log.status as keyof typeof statusConfig];
        const StatusIcon = statusInfo.icon;
        const hours = log.total_hours || 0;
        const hasLocationIssue = log.notes && (
          log.notes.includes('LOCATION PERMISSIONS DENIED') ||
          log.notes.includes('LOCATION NOT AVAILABLE')
        );
        const hasLocationDenied = log.notes && log.notes.includes('LOCATION PERMISSIONS DENIED');

        return (
          <div
            key={log.id}
            className="bg-card rounded-lg border border-border p-4 space-y-3"
          >
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={`${statusInfo.className} flex items-center gap-1.5 px-2 py-1`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {statusInfo.label}
              </Badge>
              
              {log.edit_count > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                  Edited {log.edit_count}x
                </Badge>
              )}
            </div>

            {/* Time Info */}
            {editingId === log.id ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Clock In</label>
                  <Input
                    type="datetime-local"
                    value={editData.clock_in}
                    onChange={(e) => setEditData({ ...editData, clock_in: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Clock Out</label>
                  <Input
                    type="datetime-local"
                    value={editData.clock_out}
                    onChange={(e) => setEditData({ ...editData, clock_out: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(log.id)}
                    className="flex-1"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="flex-1"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Clock In</div>
                    <div className="font-medium">
                      {format(new Date(log.clock_in), "MMM d, h:mm a")}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Clock Out</div>
                    <div className="font-medium">
                      {log.clock_out ? (
                        format(new Date(log.clock_out), "MMM d, h:mm a")
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning">
                          In Progress
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(log)}
                  className="w-full mt-2"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit Times
                </Button>
              </>
            )}

            {/* Hours */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Total Hours</span>
              <span className="text-lg font-bold text-foreground">
                {hours.toFixed(2)}h
              </span>
            </div>

            {/* Location Warning */}
            {hasLocationIssue && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border/50">
                <AlertCircle className={`h-4 w-4 mt-0.5 ${hasLocationDenied ? 'text-destructive' : 'text-warning'}`} />
                <div className="flex-1 text-xs">
                  <p className={`font-medium ${hasLocationDenied ? 'text-destructive' : 'text-warning'}`}>
                    {hasLocationDenied ? 'Location Access Denied' : 'Location Unavailable'}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {hasLocationDenied 
                      ? 'Location permissions were denied during clock-in'
                      : 'Location could not be captured during clock-in'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {log.notes && !hasLocationIssue && (
              <div className="pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <div className="text-sm text-foreground whitespace-pre-wrap">
                  {log.notes}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
