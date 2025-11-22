import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Clock, MapPin, FileText, Send, CheckCircle, Download } from "lucide-react";
import TimesheetMapView from "@/components/timesheets/TimesheetMapView";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function TimesheetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  // Fetch timesheet
  const { data: timesheet, isLoading: timesheetLoading } = useQuery({
    queryKey: ["timesheet", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch creator profile
      if (data) {
        const { data: creator } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("id", data.created_by)
          .single();

        return { ...data, creator } as any;
      }

      return data;
    },
  });

  // Fetch time logs for this timesheet
  const { data: timeLogs = [], isLoading: timeLogsLoading } = useQuery({
    queryKey: ["timesheet-logs", id],
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
          )
        `)
        .eq("timesheet_id", id)
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

  // Calculate totals
  const totalHours = timeLogs.reduce((sum, log) => sum + (log.total_hours || 0), 0);
  const workerName = timeLogs[0]?.profiles ? 
    `${timeLogs[0].profiles.first_name} ${timeLogs[0].profiles.last_name}` : 
    "Unknown Worker";

  // Submit timesheet
  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("timesheets")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
          notes: notes || null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Timesheet submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["timesheet", id] });
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to submit timesheet: ${error.message}`);
    },
  });

  // Approve timesheet
  const approveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("timesheets")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Timesheet approved");
      queryClient.invalidateQueries({ queryKey: ["timesheet", id] });
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to approve timesheet: ${error.message}`);
    },
  });

  // Export timesheet
  const exportMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("timesheets")
        .update({
          status: "exported",
          exported_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      // Generate CSV data
      const csvHeader = "Worker,Date,Clock In,Clock Out,Total Hours,Appointment,Location\n";
      const csvRows = timeLogs.map(log => {
        const worker = `${log.profiles?.first_name} ${log.profiles?.last_name}`;
        const date = format(new Date(log.clock_in), "yyyy-MM-dd");
        const clockIn = format(new Date(log.clock_in), "HH:mm");
        const clockOut = log.clock_out ? format(new Date(log.clock_out), "HH:mm") : "N/A";
        const hours = (log.total_hours || 0).toFixed(2);
        const appointment = log.appointments?.title || "N/A";
        const location = log.appointments?.location_address || "N/A";
        return `"${worker}","${date}","${clockIn}","${clockOut}","${hours}","${appointment}","${location}"`;
      }).join("\n");

      const csv = csvHeader + csvRows;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timesheet-${timesheet?.week_start_date}-${workerName.replace(/\s/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success("Timesheet exported for payroll");
      queryClient.invalidateQueries({ queryKey: ["timesheet", id] });
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to export timesheet: ${error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500";
      case "submitted": return "bg-blue-500";
      case "approved": return "bg-green-500";
      case "exported": return "bg-purple-500";
      default: return "bg-gray-500";
    }
  };

  if (timesheetLoading || timeLogsLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!timesheet) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold">Timesheet not found</h2>
            <Button className="mt-4" onClick={() => navigate("/timesheets")}>
              Back to Timesheets
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/timesheets")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Timesheet #{timesheet.id.slice(0, 8)}</h1>
              <p className="text-muted-foreground">
                {format(new Date(timesheet.week_start_date), "MMM d")} - {format(new Date(timesheet.week_end_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <Badge className={getStatusColor(timesheet.status)}>
            {timesheet.status}
          </Badge>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {timesheet.status === "draft" && (
                <>
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Approval
                  </Button>
                  <div className="flex-1">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes about this timesheet..."
                      rows={2}
                    />
                  </div>
                </>
              )}
              {timesheet.status === "submitted" && (
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Timesheet
                </Button>
              )}
              {timesheet.status === "approved" && (
                <Button
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export for Payroll
                </Button>
              )}
              {timesheet.status === "exported" && (
                <div className="text-sm text-muted-foreground">
                  Exported on {format(new Date(timesheet.exported_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Worker</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workerName}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHours.toFixed(2)}h</div>
              <p className="text-xs text-muted-foreground">
                {timeLogs.length} time log{timeLogs.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Created By</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">
                {timesheet.creator?.first_name} {timesheet.creator?.last_name}
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(timesheet.created_at), "MMM d, yyyy")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Time Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No time logs in this timesheet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {timeLogs.map((log: any) => (
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
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {timesheet.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{timesheet.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
