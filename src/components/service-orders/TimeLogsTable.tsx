import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, X, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface TimeLogsTableProps {
  appointmentId: string;
}

const statusColors = {
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
};

export default function TimeLogsTable({ appointmentId }: TimeLogsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  const { data: timeLogs = [], isLoading } = useQuery({
    queryKey: ["time-logs", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*")
        .eq("appointment_id", appointmentId)
        .order("clock_in", { ascending: false });

      if (error) throw error;

      // Fetch worker details
      const logsWithWorkers = await Promise.all(
        (data || []).map(async (log: any) => {
          const { data: worker } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("id", log.worker_id)
            .single();
          return { ...log, worker };
        })
      );

      return logsWithWorkers;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("time_logs")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", appointmentId] });
      toast({ title: "Time log updated successfully" });
      setEditingId(null);
      setEditData({});
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", appointmentId] });
      toast({ title: "Time log deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setEditData({
      clock_in: format(new Date(log.clock_in), "yyyy-MM-dd'T'HH:mm"),
      clock_out: log.clock_out ? format(new Date(log.clock_out), "yyyy-MM-dd'T'HH:mm") : "",
      hourly_rate: log.hourly_rate,
      overhead_percentage: log.overhead_percentage,
      status: log.status,
    });
  };

  const handleSave = (id: string) => {
    const updates: any = {
      clock_in: new Date(editData.clock_in).toISOString(),
      hourly_rate: parseFloat(editData.hourly_rate),
      overhead_percentage: parseFloat(editData.overhead_percentage),
      status: editData.status,
    };

    if (editData.clock_out) {
      updates.clock_out = new Date(editData.clock_out).toISOString();
    }

    updateMutation.mutate({ id, updates });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading time logs...</div>;
  }

  if (timeLogs.length === 0) {
    return <div className="text-sm text-muted-foreground py-4">No time logs recorded</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="text-left py-2 px-2 font-medium text-[10px] uppercase">Worker</th>
            <th className="text-left py-2 px-2 font-medium text-[10px] uppercase">Clock In</th>
            <th className="text-left py-2 px-2 font-medium text-[10px] uppercase">Clock Out</th>
            <th className="text-right py-2 px-2 font-medium text-[10px] uppercase">Hours</th>
            <th className="text-right py-2 px-2 font-medium text-[10px] uppercase">Rate</th>
            <th className="text-right py-2 px-2 font-medium text-[10px] uppercase">Overhead</th>
            <th className="text-right py-2 px-2 font-medium text-[10px] uppercase">Total Cost</th>
            <th className="text-left py-2 px-2 font-medium text-[10px] uppercase">Status</th>
            <th className="text-right py-2 px-2 font-medium text-[10px] uppercase w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {timeLogs.map((log: any) => {
            const isEditing = editingId === log.id;

            return (
              <tr key={log.id} className="hover:bg-muted/30">
                <td className="py-2 px-2 text-xs">
                  {log.worker && `${log.worker.first_name} ${log.worker.last_name}`}
                </td>
                <td className="py-2 px-2 text-xs">
                  {isEditing ? (
                    <Input
                      type="datetime-local"
                      value={editData.clock_in}
                      onChange={(e) => setEditData({ ...editData, clock_in: e.target.value })}
                      className="h-7 text-xs"
                    />
                  ) : (
                    format(new Date(log.clock_in), "MMM d, h:mm a")
                  )}
                </td>
                <td className="py-2 px-2 text-xs">
                  {isEditing ? (
                    <Input
                      type="datetime-local"
                      value={editData.clock_out}
                      onChange={(e) => setEditData({ ...editData, clock_out: e.target.value })}
                      className="h-7 text-xs"
                    />
                  ) : log.clock_out ? (
                    format(new Date(log.clock_out), "MMM d, h:mm a")
                  ) : (
                    <Badge variant="outline" className="bg-warning/10 text-warning text-[9px]">
                      In Progress
                    </Badge>
                  )}
                </td>
                <td className="py-2 px-2 text-right text-xs font-medium">
                  {log.total_hours ? log.total_hours.toFixed(2) : "-"}
                </td>
                <td className="py-2 px-2 text-right text-xs">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.hourly_rate}
                      onChange={(e) => setEditData({ ...editData, hourly_rate: e.target.value })}
                      className="h-7 text-xs text-right"
                    />
                  ) : (
                    `$${log.hourly_rate.toFixed(2)}/hr`
                  )}
                </td>
                <td className="py-2 px-2 text-right text-xs">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.1"
                      value={editData.overhead_percentage}
                      onChange={(e) =>
                        setEditData({ ...editData, overhead_percentage: e.target.value })
                      }
                      className="h-7 text-xs text-right"
                    />
                  ) : (
                    `${log.overhead_percentage}%`
                  )}
                </td>
                <td className="py-2 px-2 text-right text-xs font-bold">
                  {log.total_cost ? `$${log.total_cost.toFixed(2)}` : "-"}
                </td>
                <td className="py-2 px-2 text-xs">
                  {isEditing ? (
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                      className="h-7 text-xs border rounded px-2"
                    >
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="approved">Approved</option>
                    </select>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`${statusColors[log.status as keyof typeof statusColors]} text-[9px] py-0 px-1`}
                    >
                      {log.status.replace("_", " ")}
                    </Badge>
                  )}
                </td>
                <td className="py-2 px-2 text-right">
                  {isEditing ? (
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSave(log.id)}
                        className="h-6 w-6 p-0"
                        disabled={updateMutation.isPending}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(log)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this time log?")) {
                            deleteMutation.mutate(log.id);
                          }
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
