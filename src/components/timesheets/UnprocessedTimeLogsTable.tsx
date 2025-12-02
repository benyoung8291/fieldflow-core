import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, X, AlertCircle } from "lucide-react";
import { MELBOURNE_TZ } from "@/lib/utils";
import DistanceWarningBadge from "@/components/time-logs/DistanceWarningBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UnprocessedTimeLogsTableProps {
  timeLogs: any[];
  selectedWeek: Date;
}

export function UnprocessedTimeLogsTable({ timeLogs, selectedWeek }: UnprocessedTimeLogsTableProps) {
  const queryClient = useQueryClient();
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");

  const updateTimeLog = useMutation({
    mutationFn: async ({ 
      logId, 
      clockIn, 
      clockOut 
    }: { 
      logId: string; 
      clockIn: string; 
      clockOut: string;
    }) => {
      // Get current user for audit trail
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Convert Melbourne timezone inputs to UTC ISO strings
      const clockInUTC = fromZonedTime(new Date(clockIn), MELBOURNE_TZ).toISOString();
      const clockOutUTC = fromZonedTime(new Date(clockOut), MELBOURNE_TZ).toISOString();

      // Calculate hours
      const hours = (new Date(clockOutUTC).getTime() - new Date(clockInUTC).getTime()) / (1000 * 60 * 60);

      // Get current edit_count
      const { data: currentLog } = await supabase
        .from("time_logs")
        .select("edit_count")
        .eq("id", logId)
        .single();

      const { error } = await supabase
        .from("time_logs")
        .update({
          clock_in: clockInUTC,
          clock_out: clockOutUTC,
          total_hours: hours,
          edited_at: new Date().toISOString(),
          edited_by: user.id,
          edit_count: (currentLog?.edit_count || 0) + 1,
        })
        .eq("id", logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-time-logs", selectedWeek.toISOString()] });
      toast.success("Time log updated successfully");
      setEditingLogId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update time log");
    },
  });

  const startEditing = (log: any) => {
    setEditingLogId(log.id);
    // Convert UTC times to Melbourne timezone for display
    setEditClockIn(formatInTimeZone(new Date(log.clock_in), MELBOURNE_TZ, "yyyy-MM-dd'T'HH:mm"));
    setEditClockOut(formatInTimeZone(new Date(log.clock_out), MELBOURNE_TZ, "yyyy-MM-dd'T'HH:mm"));
  };

  const cancelEditing = () => {
    setEditingLogId(null);
    setEditClockIn("");
    setEditClockOut("");
  };

  const saveEdit = (logId: string) => {
    updateTimeLog.mutate({
      logId,
      clockIn: editClockIn,
      clockOut: editClockOut,
    });
  };

  if (timeLogs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No unprocessed time logs for this week</p>
        <p className="text-sm mt-2">All time logs have been added to timesheets</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Worker</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Appointment</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Clock In</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Clock Out</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Hours</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Distance</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {timeLogs.map((log: any) => {
            const isEditing = editingLogId === log.id;
            
            return (
              <tr key={log.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {log.profiles?.first_name} {log.profiles?.last_name}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">
                    <div className="font-medium">{log.appointments?.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {log.appointments?.location_address}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <Input
                      type="datetime-local"
                      value={editClockIn}
                      onChange={(e) => setEditClockIn(e.target.value)}
                      className="w-44"
                    />
                  ) : (
                    <div className="text-sm">
                      {formatInTimeZone(new Date(log.clock_in), MELBOURNE_TZ, "MMM d, yyyy")}
                      <div className="text-muted-foreground">
                        {formatInTimeZone(new Date(log.clock_in), MELBOURNE_TZ, "h:mm a")}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <Input
                      type="datetime-local"
                      value={editClockOut}
                      onChange={(e) => setEditClockOut(e.target.value)}
                      className="w-44"
                    />
                  ) : (
                    <div className="text-sm">
                      {formatInTimeZone(new Date(log.clock_out), MELBOURNE_TZ, "MMM d, yyyy")}
                      <div className="text-muted-foreground">
                        {formatInTimeZone(new Date(log.clock_out), MELBOURNE_TZ, "h:mm a")}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{log.total_hours?.toFixed(2)}h</div>
                </td>
                <td className="px-4 py-3">
                  <DistanceWarningBadge distance={log.clockInDistance} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.status === "completed" ? "default" : "secondary"}>
                      {log.status}
                    </Badge>
                    {log.edit_count > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Edited {log.edit_count}x
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <div className="font-medium">Last edited:</div>
                              <div>{log.edited_at ? format(new Date(log.edited_at), "MMM d, yyyy h:mm a") : "N/A"}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEdit(log.id)}
                          disabled={updateTimeLog.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditing}
                          disabled={updateTimeLog.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditing(log)}
                      >
                        Edit Times
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
