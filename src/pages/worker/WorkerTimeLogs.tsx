import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, MapPin, Calendar, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-warning/20 text-warning border-warning/30",
  },
  processed: {
    label: "Processed",
    className: "bg-info/20 text-info border-info/30",
  },
  approved: {
    label: "Approved",
    className: "bg-success/20 text-success border-success/30",
  },
};

export default function WorkerTimeLogs() {
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: timeLogs = [], isLoading } = useQuery({
    queryKey: ["worker-all-time-logs", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data, error } = await supabase
        .from("time_logs")
        .select(`
          *,
          appointments (
            title,
            location_address,
            service_order_id
          )
        `)
        .eq("worker_id", currentUser.id)
        .order("clock_in", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser?.id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-3 py-2.5">
          <h1 className="text-base font-semibold">My Time Logs</h1>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">

        {timeLogs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No time logs recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
          {timeLogs.map((log) => {
            const statusInfo = statusConfig[log.timesheet_status as keyof typeof statusConfig];
            const hours = log.total_hours || 0;
            const hasLocationIssue = log.notes && (
              log.notes.includes('LOCATION PERMISSIONS DENIED') ||
              log.notes.includes('LOCATION NOT AVAILABLE')
            );

            return (
              <Card key={log.id}>
                <CardContent className="p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate leading-tight">
                        {log.appointments?.title || 'Appointment'}
                      </h3>
                      {log.appointments?.location_address && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{log.appointments.location_address}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={`${statusInfo.className} shrink-0 text-[10px] h-5`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground mb-1">Clock In</div>
                      <div className="font-medium flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(log.clock_in), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Clock Out</div>
                      <div className="font-medium flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {log.clock_out ? (
                          format(new Date(log.clock_out), "MMM d, h:mm a")
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning text-[10px] h-5">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Total Hours</span>
                    <span className="text-base font-bold text-foreground">
                      {hours.toFixed(2)}h
                    </span>
                  </div>

                  {log.edit_count > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 h-5">
                      Edited {log.edit_count} time{log.edit_count > 1 ? 's' : ''}
                    </Badge>
                  )}

                  {hasLocationIssue && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-warning/5 border border-warning/20">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-warning" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-warning">Location Issue</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Location data was not captured
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
