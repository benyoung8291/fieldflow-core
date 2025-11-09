import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";

interface WorkerAvailabilityProps {
  workerId: string;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function WorkerAvailability({ workerId }: WorkerAvailabilityProps) {
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isUnavailableDialogOpen, setIsUnavailableDialogOpen] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1);
  const [scheduleFormData, setScheduleFormData] = useState({
    start_time: "09:00",
    end_time: "17:00",
  });
  const [unavailableFormData, setUnavailableFormData] = useState({
    start_date: new Date(),
    end_date: new Date(),
    start_time: "",
    end_time: "",
    reason: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  // Fetch worker's regular schedule
  const { data: schedule = [] } = useQuery({
    queryKey: ["worker-schedule", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_schedule")
        .select("*")
        .eq("worker_id", workerId)
        .eq("is_active", true)
        .order("day_of_week");

      if (error) throw error;
      return data;
    },
  });

  // Fetch worker's unavailable periods
  const { data: unavailability = [] } = useQuery({
    queryKey: ["worker-unavailability", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_unavailability")
        .select("*")
        .eq("worker_id", workerId)
        .gte("end_date", format(new Date(), "yyyy-MM-dd"))
        .order("start_date");

      if (error) throw error;
      return data;
    },
  });

  const getTenantId = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", workerId)
      .single();
    return profile?.tenant_id;
  };

  const createOrUpdateSchedule = useMutation({
    mutationFn: async () => {
      const tenant_id = await getTenantId();
      
      const existingDay = schedule.find(s => s.day_of_week === selectedDayOfWeek);
      
      if (existingDay) {
        const { error } = await supabase
          .from("worker_schedule")
          .update({
            start_time: scheduleFormData.start_time,
            end_time: scheduleFormData.end_time,
          })
          .eq("id", existingDay.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("worker_schedule")
          .insert({
            tenant_id,
            worker_id: workerId,
            day_of_week: selectedDayOfWeek,
            start_time: scheduleFormData.start_time,
            end_time: scheduleFormData.end_time,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-schedule", workerId] });
      toast.success("Schedule updated successfully");
      setIsScheduleDialogOpen(false);
    },
    onError: () => {
      toast.error("Failed to update schedule");
    },
  });

  const deleteScheduleDay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("worker_schedule")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-schedule", workerId] });
      toast.success("Schedule day removed");
    },
    onError: () => {
      toast.error("Failed to remove schedule day");
    },
  });

  const createUnavailability = useMutation({
    mutationFn: async () => {
      const tenant_id = await getTenantId();

      const { error } = await supabase
        .from("worker_unavailability")
        .insert({
          tenant_id,
          worker_id: workerId,
          start_date: format(unavailableFormData.start_date, "yyyy-MM-dd"),
          end_date: format(unavailableFormData.end_date, "yyyy-MM-dd"),
          start_time: unavailableFormData.start_time || null,
          end_time: unavailableFormData.end_time || null,
          reason: unavailableFormData.reason,
          notes: unavailableFormData.notes,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-unavailability", workerId] });
      toast.success("Unavailability added successfully");
      setIsUnavailableDialogOpen(false);
      setUnavailableFormData({
        start_date: new Date(),
        end_date: new Date(),
        start_time: "",
        end_time: "",
        reason: "",
        notes: "",
      });
    },
    onError: () => {
      toast.error("Failed to add unavailability");
    },
  });

  const deleteUnavailability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("worker_unavailability")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-unavailability", workerId] });
      toast.success("Unavailability deleted");
    },
    onError: () => {
      toast.error("Failed to delete unavailability");
    },
  });

  const scheduleByDay = schedule.reduce((acc, item) => {
    acc[item.day_of_week] = item;
    return acc;
  }, {} as Record<number, any>);

  return (
    <div className="grid gap-4">
      {/* Regular Weekly Schedule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Regular Weekly Schedule</CardTitle>
            <Button size="sm" onClick={() => setIsScheduleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Day
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day, index) => {
              const daySchedule = scheduleByDay[index];
              return (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="font-medium w-24">{day}</div>
                    {daySchedule ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{daySchedule.start_time} - {daySchedule.end_time}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not working</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDayOfWeek(index);
                        if (daySchedule) {
                          setScheduleFormData({
                            start_time: daySchedule.start_time,
                            end_time: daySchedule.end_time,
                          });
                        } else {
                          setScheduleFormData({
                            start_time: "09:00",
                            end_time: "17:00",
                          });
                        }
                        setIsScheduleDialogOpen(true);
                      }}
                    >
                      {daySchedule ? "Edit" : "Add"}
                    </Button>
                    {daySchedule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteScheduleDay.mutate(daySchedule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Unavailable Periods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Unavailable Periods</CardTitle>
            <Button size="sm" onClick={() => setIsUnavailableDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Period
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unavailability.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unavailable periods set</p>
          ) : (
            <div className="space-y-2">
              {unavailability.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {format(new Date(item.start_date), "MMM d, yyyy")} -{" "}
                      {format(new Date(item.end_date), "MMM d, yyyy")}
                    </div>
                    {item.start_time && item.end_time && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{item.start_time} - {item.end_time}</span>
                      </div>
                    )}
                    {item.reason && (
                      <Badge variant="secondary" className="mt-1">{item.reason}</Badge>
                    )}
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteUnavailability.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Schedule for {DAYS_OF_WEEK[selectedDayOfWeek]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={scheduleFormData.start_time}
                  onChange={(e) =>
                    setScheduleFormData({ ...scheduleFormData, start_time: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={scheduleFormData.end_time}
                  onChange={(e) =>
                    setScheduleFormData({ ...scheduleFormData, end_time: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => createOrUpdateSchedule.mutate()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unavailability Dialog */}
      <Dialog open={isUnavailableDialogOpen} onOpenChange={setIsUnavailableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Unavailable Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Calendar
                  mode="single"
                  selected={unavailableFormData.start_date}
                  onSelect={(date) =>
                    setUnavailableFormData({ ...unavailableFormData, start_date: date || new Date() })
                  }
                  className="rounded-md border"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Calendar
                  mode="single"
                  selected={unavailableFormData.end_date}
                  onSelect={(date) =>
                    setUnavailableFormData({ ...unavailableFormData, end_date: date || new Date() })
                  }
                  className="rounded-md border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unavail_start_time">Start Time (Optional)</Label>
                <Input
                  id="unavail_start_time"
                  type="time"
                  value={unavailableFormData.start_time}
                  onChange={(e) =>
                    setUnavailableFormData({ ...unavailableFormData, start_time: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="unavail_end_time">End Time (Optional)</Label>
                <Input
                  id="unavail_end_time"
                  type="time"
                  value={unavailableFormData.end_time}
                  onChange={(e) =>
                    setUnavailableFormData({ ...unavailableFormData, end_time: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={unavailableFormData.reason}
                onChange={(e) =>
                  setUnavailableFormData({ ...unavailableFormData, reason: e.target.value })
                }
                placeholder="e.g., Vacation, Training, etc."
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={unavailableFormData.notes}
                onChange={(e) =>
                  setUnavailableFormData({ ...unavailableFormData, notes: e.target.value })
                }
                placeholder="Additional details..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsUnavailableDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => createUnavailability.mutate()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}