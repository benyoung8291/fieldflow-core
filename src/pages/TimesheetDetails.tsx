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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TimesheetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    clock_in: string;
    clock_out: string;
  }>({ clock_in: "", clock_out: "" });

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

  // Update time log
  const updateTimeLogMutation = useMutation({
    mutationFn: async ({ logId, clockIn, clockOut }: { logId: string; clockIn: string; clockOut: string }) => {
      // Get current edit count
      const { data: currentLog } = await supabase
        .from("time_logs")
        .select("edit_count")
        .eq("id", logId)
        .single();

      const { error } = await supabase
        .from("time_logs")
        .update({
          clock_in: clockIn,
          clock_out: clockOut,
          edit_count: (currentLog?.edit_count || 0) + 1,
        })
        .eq("id", logId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Time log updated");
      queryClient.invalidateQueries({ queryKey: ["timesheet-logs", id] });
      setEditingLogId(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update time log: ${error.message}`);
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

  const handleEditLog = (log: any) => {
    setEditingLogId(log.id);
    setEditData({
      clock_in: log.clock_in,
      clock_out: log.clock_out || "",
    });
  };

  const handleSaveEdit = (logId: string) => {
    if (!editData.clock_in) {
      toast.error("Clock in time is required");
      return;
    }
    updateTimeLogMutation.mutate({
      logId,
      clockIn: editData.clock_in,
      clockOut: editData.clock_out,
    });
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setEditData({ clock_in: "", clock_out: "" });
  };

  const calculateTotalHours = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 0;
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    return ((end.getTime() - start.getTime()) / (1000 * 60 * 60));
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Appointment</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Status</TableHead>
                      {timesheet.status === "draft" && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.appointments?.title || 'Appointment'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            {log.appointments?.location_address ? (
                              <>
                                <MapPin className="h-3 w-3" />
                                {log.appointments.location_address}
                              </>
                            ) : (
                              <span className="text-muted-foreground">No location</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {editingLogId === log.id ? (
                            <Input
                              type="datetime-local"
                              value={editData.clock_in ? format(new Date(editData.clock_in), "yyyy-MM-dd'T'HH:mm") : ""}
                              onChange={(e) => setEditData({ ...editData, clock_in: new Date(e.target.value).toISOString() })}
                              className="w-48"
                            />
                          ) : (
                            format(new Date(log.clock_in), "MMM d, h:mm a")
                          )}
                        </TableCell>
                        <TableCell>
                          {editingLogId === log.id ? (
                            <Input
                              type="datetime-local"
                              value={editData.clock_out ? format(new Date(editData.clock_out), "yyyy-MM-dd'T'HH:mm") : ""}
                              onChange={(e) => setEditData({ ...editData, clock_out: e.target.value ? new Date(e.target.value).toISOString() : "" })}
                              className="w-48"
                            />
                          ) : (
                            log.clock_out ? format(new Date(log.clock_out), "MMM d, h:mm a") : "In Progress"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingLogId === log.id && editData.clock_in && editData.clock_out ? (
                            <span className="font-medium">
                              {calculateTotalHours(editData.clock_in, editData.clock_out).toFixed(2)}h
                            </span>
                          ) : (
                            <span className="font-medium">
                              {(log.total_hours || 0).toFixed(2)}h
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TimesheetMapView timeLog={log} />
                            {log.edit_count > 0 && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                Edited {log.edit_count}x
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {timesheet.status === "draft" && (
                          <TableCell className="text-right">
                            {editingLogId === log.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(log.id)}
                                  disabled={updateTimeLogMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  disabled={updateTimeLogMutation.isPending}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditLog(log)}
                              >
                                Edit
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
