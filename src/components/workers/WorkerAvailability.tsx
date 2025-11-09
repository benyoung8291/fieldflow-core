import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock } from "lucide-react";
import { format } from "date-fns";

interface WorkerAvailabilityProps {
  workerId: string;
}

export default function WorkerAvailability({ workerId }: WorkerAvailabilityProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    start_time: "09:00",
    end_time: "17:00",
    is_available: true,
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: availability = [] } = useQuery({
    queryKey: ["worker-availability", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_availability")
        .select("*")
        .eq("worker_id", workerId)
        .order("date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const createAvailability = useMutation({
    mutationFn: async () => {
      if (!selectedDate) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", workerId)
        .single();

      const { error } = await supabase.from("worker_availability").insert({
        tenant_id: profile?.tenant_id,
        worker_id: workerId,
        date: format(selectedDate, "yyyy-MM-dd"),
        start_time: formData.start_time,
        end_time: formData.end_time,
        is_available: formData.is_available,
        notes: formData.notes,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-availability", workerId] });
      toast.success("Availability added successfully");
      setIsDialogOpen(false);
      setFormData({
        start_time: "09:00",
        end_time: "17:00",
        is_available: true,
        notes: "",
      });
    },
    onError: () => {
      toast.error("Failed to add availability");
    },
  });

  const deleteAvailability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("worker_availability")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-availability", workerId] });
      toast.success("Availability deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete availability");
    },
  });

  const availabilityByDate = availability.reduce((acc, item) => {
    acc[item.date] = item;
    return acc;
  }, {} as Record<string, any>);

  const selectedDateAvailability = selectedDate
    ? availabilityByDate[format(selectedDate, "yyyy-MM-dd")]
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={{
              available: availability
                .filter((a) => a.is_available)
                .map((a) => new Date(a.date)),
              unavailable: availability
                .filter((a) => !a.is_available)
                .map((a) => new Date(a.date)),
            }}
            modifiersClassNames={{
              available: "bg-success/20 text-success",
              unavailable: "bg-destructive/20 text-destructive",
            }}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
            </CardTitle>
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selectedDateAvailability ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={selectedDateAvailability.is_available ? "default" : "destructive"}>
                  {selectedDateAvailability.is_available ? "Available" : "Unavailable"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAvailability.mutate(selectedDateAvailability.id)}
                >
                  Remove
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {selectedDateAvailability.start_time} - {selectedDateAvailability.end_time}
                </span>
              </div>
              {selectedDateAvailability.notes && (
                <div className="text-sm">
                  <div className="font-medium mb-1">Notes:</div>
                  <div className="text-muted-foreground">{selectedDateAvailability.notes}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No availability set for this date. Click "Add" to create one.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Availability for {selectedDate && format(selectedDate, "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_available">Available</Label>
              <Switch
                id="is_available"
                checked={formData.is_available}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_available: checked })
                }
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Add any notes about this availability..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => createAvailability.mutate()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
