import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface CreateTimeLogDialogProps {
  appointmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTimeLogDialog({ appointmentId, open, onOpenChange }: CreateTimeLogDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [workerId, setWorkerId] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [overheadPercentage, setOverheadPercentage] = useState("30");
  const [status, setStatus] = useState("completed");

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-time-log"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("tenant_id", profile?.tenant_id)
        .order("first_name");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const clockInDate = new Date(clockIn);
      const clockOutDate = clockOut ? new Date(clockOut) : null;

      let totalHours = null;
      let totalCost = null;

      if (clockOutDate) {
        totalHours = (clockOutDate.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);
        const baseRate = parseFloat(hourlyRate);
        const overhead = baseRate * (parseFloat(overheadPercentage) / 100);
        totalCost = (baseRate + overhead) * totalHours;
      }

      const { error } = await supabase
        .from("time_logs")
        .insert({
          appointment_id: appointmentId,
          worker_id: workerId,
          clock_in: clockInDate.toISOString(),
          clock_out: clockOutDate?.toISOString(),
          hourly_rate: parseFloat(hourlyRate),
          overhead_percentage: parseFloat(overheadPercentage),
          total_hours: totalHours,
          total_cost: totalCost,
          status,
          notes: "Manually created by supervisor",
          tenant_id: profile.tenant_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", appointmentId] });
      toast({ title: "Time log created successfully" });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create time log",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setWorkerId("");
    setClockIn("");
    setClockOut("");
    setHourlyRate("");
    setOverheadPercentage("30");
    setStatus("completed");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workerId || !clockIn || !hourlyRate) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      toast({
        title: "Invalid time range",
        description: "Clock out time must be after clock in time",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Time Log</DialogTitle>
            <DialogDescription>
              Manually create a time log entry for this appointment
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="worker">Worker *</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker: any) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clock-in">Clock In *</Label>
              <Input
                id="clock-in"
                type="datetime-local"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clock-out">Clock Out (Optional)</Label>
              <Input
                id="clock-out"
                type="datetime-local"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hourly-rate">Hourly Rate ($) *</Label>
                <Input
                  id="hourly-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="overhead">Overhead (%) *</Label>
                <Input
                  id="overhead"
                  type="number"
                  step="0.1"
                  min="0"
                  value={overheadPercentage}
                  onChange={(e) => setOverheadPercentage(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Time Log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}