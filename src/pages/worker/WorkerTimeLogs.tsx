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
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">My Time Logs</h1>
      </div>

      {timeLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No time logs recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {timeLogs.map((log) => {
            const statusInfo = statusConfig[log.timesheet_status as keyof typeof statusConfig];
            const hours = log.total_hours || 0;
            const hasLocationIssue = log.notes && (
              log.notes.includes('LOCATION PERMISSIONS DENIED') ||
              log.notes.includes('LOCATION NOT AVAILABLE')
            );

            return (
              <Card key={log.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold">
                        {log.appointments?.title || 'Appointment'}
                      </CardTitle>
                      {log.appointments?.location_address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="line-clamp-1">{log.appointments.location_address}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Clock In</div>
                      <div className="font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.clock_in), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">Clock Out</div>
                      <div className="font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
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

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Total Hours</span>
                    <span className="text-lg font-bold text-foreground">
                      {hours.toFixed(2)}h
                    </span>
                  </div>

                  {log.edit_count > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                      Edited {log.edit_count} time{log.edit_count > 1 ? 's' : ''}
                    </Badge>
                  )}

                  {hasLocationIssue && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border/50">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
                      <div className="flex-1 text-xs">
                        <p className="font-medium text-warning">Location Issue</p>
                        <p className="text-muted-foreground mt-0.5">
                          Location data was not captured for this time log
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
  );
}
