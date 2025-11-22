import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

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
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: timeLogs = [], isLoading, refetch } = useQuery({
    queryKey: ["worker-time-logs", appointmentId, currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
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
    refetchInterval: 5000, // Refetch every 5 seconds
  });

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
