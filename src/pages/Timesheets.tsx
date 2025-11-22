import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar, Clock, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/DashboardLayout";
import { CreateTimesheetDialog } from "@/components/timesheets/CreateTimesheetDialog";
import { useNavigate } from "react-router-dom";

export default function Timesheets() {
  const navigate = useNavigate();
  
  // Pay week is Thu-Wed, so week starts on Thursday
  const getPayWeekStart = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 4 }); // 4 = Thursday
    return weekStart;
  };

  const [selectedWeek, setSelectedWeek] = useState(getPayWeekStart(new Date()));

  const weekEnd = addWeeks(selectedWeek, 1);
  const weekEndDisplay = new Date(weekEnd.getTime() - 1); // Show Wed as end

  // Fetch timesheets for the selected week
  const { data: timesheets = [], isLoading: timesheetsLoading } = useQuery({
    queryKey: ["timesheets", selectedWeek.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .gte("week_start_date", format(selectedWeek, "yyyy-MM-dd"))
        .lt("week_end_date", format(weekEnd, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch creator profiles separately
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map(t => t.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", creatorIds);

        // Map profiles to timesheets
        return data.map(timesheet => ({
          ...timesheet,
          creator: profiles?.find(p => p.id === timesheet.created_by)
        })) as any[];
      }

      return data || [];
    },
  });

  // Fetch time logs for the selected week to show summary
  const { data: timeLogs = [], isLoading: timeLogsLoading } = useQuery({
    queryKey: ["timesheet-time-logs", selectedWeek.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select(`
          *,
          appointments (
            id,
            title,
            location_address
          )
        `)
        .gte("clock_in", selectedWeek.toISOString())
        .lt("clock_in", weekEnd.toISOString())
        .order("clock_in", { ascending: true });

      if (error) throw error;

      // Fetch worker profiles separately
      if (data && data.length > 0) {
        const workerIds = [...new Set(data.map(t => t.worker_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", workerIds);

        // Map profiles to time logs
        return data.map(log => ({
          ...log,
          profiles: profiles?.find(p => p.id === log.worker_id)
        })) as any[];
      }

      return data || [];
    },
  });

  // Group time logs by timesheet status
  const unprocessedLogs = timeLogs.filter(log => !log.timesheet_id);
  const processedLogs = timeLogs.filter(log => log.timesheet_id);

  // Group unprocessed logs by worker
  const logsByWorker = unprocessedLogs.reduce((acc: any, log: any) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500";
      case "submitted": return "bg-blue-500";
      case "approved": return "bg-green-500";
      case "exported": return "bg-purple-500";
      default: return "bg-gray-500";
    }
  };

  const isLoading = timesheetsLoading || timeLogsLoading;

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
            <h1 className="text-3xl font-bold">Timesheets</h1>
            <p className="text-muted-foreground">
              Manage worker timesheets for payroll processing
            </p>
          </div>
          <CreateTimesheetDialog selectedWeekStart={selectedWeek} />
        </div>

        {/* Week Navigation */}
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
        </Card>

        {/* Created Timesheets */}
        {timesheets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Created Timesheets ({timesheets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timesheets.map((timesheet: any) => {
                  // Get time logs count for this timesheet
                  const timesheetLogs = timeLogs.filter(log => log.timesheet_id === timesheet.id);
                  const timesheetHours = timesheetLogs.reduce((sum, log) => sum + (log.total_hours || 0), 0);
                  const workerName = timesheetLogs[0]?.profiles ? 
                    `${timesheetLogs[0].profiles.first_name} ${timesheetLogs[0].profiles.last_name}` : 
                    "Unknown";

                  return (
                    <div 
                      key={timesheet.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/timesheets/${timesheet.id}`)}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="font-medium">
                          {workerName} - Week of {format(new Date(timesheet.week_start_date), "MMM d")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {timesheetLogs.length} time log{timesheetLogs.length !== 1 ? 's' : ''} • {timesheetHours.toFixed(2)}h total
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created by {timesheet.creator?.first_name} {timesheet.creator?.last_name} on {format(new Date(timesheet.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                      <Badge className={getStatusColor(timesheet.status)}>
                        {timesheet.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unprocessed Time Logs Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Unprocessed Time Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(logsByWorker).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No unprocessed time logs for this week</p>
                <p className="text-sm mt-2">All time logs have been added to timesheets</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(logsByWorker).map(([workerId, data]: [string, any]) => (
                  <div key={workerId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {data.worker?.first_name} {data.worker?.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {data.logs.length} time log{data.logs.length !== 1 ? 's' : ''} ready to process
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {data.totalHours.toFixed(2)}h
                        </div>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Time Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{timeLogs.length}</div>
              <p className="text-xs text-muted-foreground">
                This pay week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Processed Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{processedLogs.length}</div>
              <p className="text-xs text-muted-foreground">
                {((processedLogs.length / Math.max(timeLogs.length, 1)) * 100).toFixed(0)}% complete
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {timeLogs.reduce((sum, log) => sum + (log.total_hours || 0), 0).toFixed(2)}h
              </div>
              <p className="text-xs text-muted-foreground">
                Across all workers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Timesheets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{timesheets.length}</div>
              <p className="text-xs text-muted-foreground">
                Created this week
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
