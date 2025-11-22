import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TimesheetMapView from "@/components/timesheets/TimesheetMapView";

export default function Timesheets() {
  // Pay week is Thu-Wed, so week starts on Thursday
  const getPayWeekStart = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 4 }); // 4 = Thursday
    return weekStart;
  };

  const [selectedWeek, setSelectedWeek] = useState(getPayWeekStart(new Date()));

  const weekEnd = addWeeks(selectedWeek, 1);
  const weekEndDisplay = new Date(weekEnd.getTime() - 1); // Show Wed as end

  const { data: timeLogs = [], isLoading } = useQuery({
    queryKey: ["timesheet-time-logs", selectedWeek.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select(`
          *,
          appointments (
            id,
            title,
            location_address,
            location_lat,
            location_lng
          ),
          profiles:worker_id (
            first_name,
            last_name
          )
        `)
        .gte("clock_in", selectedWeek.toISOString())
        .lt("clock_in", weekEnd.toISOString())
        .order("clock_in", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Group by worker
  const timeLogsByWorker = timeLogs.reduce((acc, log) => {
    const workerId = log.worker_id;
    if (!acc[workerId]) {
      acc[workerId] = {
        worker: log.profiles,
        logs: [],
        totalHours: 0,
      };
    }
    acc[workerId].logs.push(log);
    acc[workerId].totalHours += log.total_hours || 0;
    return acc;
  }, {} as Record<string, any>);

  const previousWeek = () => setSelectedWeek(subWeeks(selectedWeek, 1));
  const nextWeek = () => setSelectedWeek(addWeeks(selectedWeek, 1));
  const currentWeek = () => setSelectedWeek(getPayWeekStart(new Date()));

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <p className="text-muted-foreground">
            Manage and approve worker time logs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pay Week: {format(selectedWeek, "MMM d")} - {format(weekEndDisplay, "MMM d, yyyy")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={previousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={currentWeek}>
                Current Week
              </Button>
              <Button variant="outline" size="sm" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(timeLogsByWorker).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time logs for this week</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(timeLogsByWorker).map(([workerId, data]) => (
                <div key={workerId} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {data.worker?.first_name} {data.worker?.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {data.logs.length} time log{data.logs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {data.totalHours.toFixed(2)}h
                      </div>
                      <p className="text-xs text-muted-foreground">Total Hours</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {data.logs.map((log: any) => (
                      <div key={log.id} className="border-l-2 border-primary pl-4 py-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="font-medium">
                              {log.appointments?.title || 'Appointment'}
                            </div>
                            {log.appointments?.location_address && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {log.appointments.location_address}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              <span>
                                {format(new Date(log.clock_in), "EEE, MMM d h:mm a")}
                              </span>
                              <span>→</span>
                              <span>
                                {log.clock_out 
                                  ? format(new Date(log.clock_out), "h:mm a")
                                  : "In Progress"
                                }
                              </span>
                              <Badge variant="outline" className="ml-auto">
                                {(log.total_hours || 0).toFixed(2)}h
                              </Badge>
                            </div>
                          </div>
                          <TimesheetMapView timeLog={log} />
                        </div>
                        {log.edit_count > 0 && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 mt-2">
                            Edited {log.edit_count}x
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
