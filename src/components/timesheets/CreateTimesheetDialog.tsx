import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { format, startOfWeek, addWeeks } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateTimesheetDialogProps {
  selectedWeekStart: Date;
}

export function CreateTimesheetDialog({ selectedWeekStart }: CreateTimesheetDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const queryClient = useQueryClient();

  const weekEnd = addWeeks(selectedWeekStart, 1);
  const weekEndDisplay = new Date(weekEnd.getTime() - 1);

  // Fetch all workers
  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch time logs for the selected week and worker
  const { data: timeLogs = [] } = useQuery({
    queryKey: ["time-logs-for-timesheet", selectedWeekStart.toISOString(), selectedWorkerId],
    queryFn: async () => {
      if (!selectedWorkerId) return [];

      const { data, error } = await supabase
        .from("time_logs")
        .select("*")
        .eq("worker_id", selectedWorkerId)
        .gte("clock_in", selectedWeekStart.toISOString())
        .lt("clock_in", weekEnd.toISOString())
        .is("timesheet_id", null)
        .order("clock_in", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWorkerId,
  });

  const createTimesheetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkerId) {
        throw new Error("Please select a worker");
      }

      if (timeLogs.length === 0) {
        throw new Error("No unprocessed time logs available for this worker in the selected week");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get tenant ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      // Create timesheet
      const { data: timesheet, error: timesheetError } = await supabase
        .from("timesheets")
        .insert({
          week_start_date: format(selectedWeekStart, "yyyy-MM-dd"),
          week_end_date: format(weekEndDisplay, "yyyy-MM-dd"),
          status: "draft",
          created_by: user.id,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (timesheetError) throw timesheetError;

      // Update time logs to link to this timesheet
      const { error: updateError } = await supabase
        .from("time_logs")
        .update({
          timesheet_id: timesheet.id,
          timesheet_status: "processed",
        })
        .in("id", timeLogs.map(log => log.id));

      if (updateError) throw updateError;

      return timesheet;
    },
    onSuccess: () => {
      toast.success("Timesheet created successfully");
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["timesheet-time-logs"] });
      queryClient.invalidateQueries({ queryKey: ["time-logs-for-timesheet"] });
      setOpen(false);
      setSelectedWorkerId("");
    },
    onError: (error: any) => {
      toast.error(`Failed to create timesheet: ${error.message}`);
    },
  });

  const handleCreate = () => {
    createTimesheetMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Timesheet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Timesheet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Pay Week</Label>
            <div className="text-sm text-muted-foreground">
              {format(selectedWeekStart, "MMM d")} - {format(weekEndDisplay, "MMM d, yyyy")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker">Worker</Label>
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger id="worker">
                <SelectValue placeholder="Select worker" />
              </SelectTrigger>
              <SelectContent>
                {workersLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading workers...
                  </SelectItem>
                ) : (
                  workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedWorkerId && (
            <div className="space-y-2">
              <Label>Available Time Logs</Label>
              <div className="text-sm text-muted-foreground">
                {timeLogs.length} unprocessed time log{timeLogs.length !== 1 ? 's' : ''} available
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!selectedWorkerId || timeLogs.length === 0 || createTimesheetMutation.isPending}
            >
              {createTimesheetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Timesheet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
