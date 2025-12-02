import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import TimeLogsFilterBar from "@/components/time-logs/TimeLogsFilterBar";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import DistanceWarningBadge from "@/components/time-logs/DistanceWarningBadge";
import { calculateDistance } from "@/lib/distance";
import TimesheetMapView from "@/components/timesheets/TimesheetMapView";
import AppointmentTimeLogsMap from "@/components/time-logs/AppointmentTimeLogsMap";

const statusColors = {
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
};

export default function TimeLogs() {
  const [filters, setFilters] = useState({
    workerId: null as string | null,
    appointmentId: null as string | null,
    startDate: null as string | null,
    endDate: null as string | null,
    status: null as string | null,
  });

  const { data: timeLogs = [], isLoading } = useQuery({
    queryKey: ["all-time-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("time_logs")
        .select(`
          *,
          appointments (
            id,
            title,
            appointment_number,
            location_address,
            location_lat,
            location_lng
          )
        `)
        .order("clock_in", { ascending: false });

      if (filters.workerId) {
        query = query.eq("worker_id", filters.workerId);
      }
      if (filters.appointmentId) {
        query = query.eq("appointment_id", filters.appointmentId);
      }
      if (filters.startDate) {
        query = query.gte("clock_in", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("clock_in", filters.endDate);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch worker profiles
      if (data && data.length > 0) {
        const workerIds = [...new Set(data.map((t) => t.worker_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", workerIds);

        return data.map((log) => ({
          ...log,
          worker: profiles?.find((p) => p.id === log.worker_id),
        }));
      }

      return data || [];
    },
  });

  // Group by appointment for map view
  const logsByAppointment = timeLogs.reduce((acc: any, log: any) => {
    const appointmentId = log.appointment_id;
    if (!acc[appointmentId]) {
      acc[appointmentId] = {
        appointment: log.appointments,
        logs: [],
      };
    }
    acc[appointmentId].logs.push(log);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Time Logs</h1>
            <p className="text-muted-foreground">
              View and manage all time log entries with location verification
            </p>
          </div>
        </div>

        <TimeLogsFilterBar onFilterChange={setFilters} />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Log Entries ({timeLogs.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {timeLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No time logs found</p>
                <p className="text-sm mt-2">Adjust filters to see more results</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(logsByAppointment).map(([appointmentId, data]: [string, any]) => {
                  const appointment = data.appointment;
                  const logs = data.logs;

                  return (
                    <div key={appointmentId} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">
                            {appointment?.appointment_number} - {appointment?.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {appointment?.location_address}
                          </p>
                        </div>
                        {appointment?.location_lat && appointment?.location_lng && (
                          <AppointmentTimeLogsMap
                            appointmentLocation={{
                              lat: appointment.location_lat,
                              lng: appointment.location_lng,
                              address: appointment.location_address || "",
                            }}
                            timeLogs={logs}
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        {logs.map((log: any) => {
                          const checkInDistance =
                            appointment?.location_lat &&
                            appointment?.location_lng &&
                            log.latitude &&
                            log.longitude
                              ? calculateDistance(
                                  appointment.location_lat,
                                  appointment.location_lng,
                                  log.latitude,
                                  log.longitude
                                )
                              : null;

                          const checkOutDistance =
                            appointment?.location_lat &&
                            appointment?.location_lng &&
                            log.check_out_lat &&
                            log.check_out_lng
                              ? calculateDistance(
                                  appointment.location_lat,
                                  appointment.location_lng,
                                  log.check_out_lat,
                                  log.check_out_lng
                                )
                              : null;

                          return (
                            <div
                              key={log.id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded border"
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {log.worker?.first_name} {log.worker?.last_name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`${
                                      statusColors[log.status as keyof typeof statusColors]
                                    } text-xs`}
                                  >
                                    {log.status.replace("_", " ")}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Clock In: {format(new Date(log.clock_in), "MMM d, h:mm a")}
                                  {log.clock_out &&
                                    ` • Clock Out: ${format(new Date(log.clock_out), "MMM d, h:mm a")}`}
                                  {log.total_hours && ` • ${log.total_hours.toFixed(2)}h`}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right text-xs space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">In:</span>
                                    <DistanceWarningBadge distance={checkInDistance} showIcon={false} />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Out:</span>
                                    <DistanceWarningBadge distance={checkOutDistance} showIcon={false} />
                                  </div>
                                </div>
                                <TimesheetMapView timeLog={log} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
