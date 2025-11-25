import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";

const daysOfWeek = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

type WorkerAvailability = Database['public']['Tables']['worker_availability']['Row'];

interface AvailabilityData {
  [key: string]: {
    id?: string;
    is_available: boolean;
    start_time: string;
    end_time: string;
  };
}

export default function WorkerCalendar() {
  const queryClient = useQueryClient();
  const [availability, setAvailability] = useState<AvailabilityData>({});
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [unavailableFrom, setUnavailableFrom] = useState("");
  const [unavailableTo, setUnavailableTo] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['worker-profile', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('tenant_id, status')
        .eq('id', currentUser.id)
        .single();

      if (error) throw error;
      
      // Set unavailable status based on profile
      if (data?.status === 'unavailable') {
        setIsUnavailable(true);
      }
      
      return data;
    },
    enabled: !!currentUser?.id,
  });

  const { isLoading } = useQuery({
    queryKey: ["worker-availability", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      
      const { data, error } = await supabase
        .from("worker_availability")
        .select("*")
        .eq("worker_id", currentUser.id);

      if (error) throw error;
      
      const availabilityMap: AvailabilityData = {};
      daysOfWeek.forEach(day => {
        const existing = data?.find((d: WorkerAvailability) => d.day_of_week === day.value);
        availabilityMap[day.value] = existing ? {
          id: existing.id,
          is_available: existing.is_available || false,
          start_time: existing.start_time,
          end_time: existing.end_time,
        } : {
          is_available: true,
          start_time: "09:00",
          end_time: "17:00",
        };
      });
      
      setAvailability(availabilityMap);
      return data || [];
    },
    enabled: !!currentUser?.id,
  });

  const saveAvailability = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id || !profile?.tenant_id) throw new Error("User not found");

      const updates = Object.entries(availability).map(([day, data]) => ({
        id: data.id,
        worker_id: currentUser.id,
        tenant_id: profile.tenant_id,
        day_of_week: day,
        is_available: data.is_available,
        start_time: data.start_time,
        end_time: data.end_time,
      }));

      // Upsert all availability records
      const { error: availError } = await supabase
        .from("worker_availability")
        .upsert(updates, { onConflict: 'worker_id,day_of_week' });

      if (availError) throw availError;

      // Update profile status
      const newStatus = isUnavailable ? 'unavailable' : 'available';
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          status: newStatus,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-availability"] });
      queryClient.invalidateQueries({ queryKey: ["worker-profile"] });
      toast.success("Availability updated");
    },
    onError: () => {
      toast.error("Failed to update availability");
    },
  });

  const updateDay = (day: string, field: 'is_available' | 'start_time' | 'end_time', value: any) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-16 pb-20 space-y-4">{/* Added pt-16 for mobile header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Availability</h1>
        <Button onClick={() => saveAvailability.mutate()}>
          Save Changes
        </Button>
      </div>

      {/* Unavailability Status */}
      <Card>
        <CardHeader>
          <CardTitle>Unavailability Status</CardTitle>
          <CardDescription>
            Mark yourself as unavailable for a period of time (e.g., leave, sick days)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={isUnavailable}
              onCheckedChange={setIsUnavailable}
            />
            <Label className="text-base">
              I am currently unavailable
            </Label>
          </div>

          {isUnavailable && (
            <div className="space-y-4 pl-8 border-l-2 border-warning">
              <div className="flex items-start gap-2 text-warning">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <p className="text-sm">
                  You will not be assigned to new appointments while marked as unavailable
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unavailable-from">Unavailable From (Optional)</Label>
                  <input
                    id="unavailable-from"
                    type="date"
                    value={unavailableFrom}
                    onChange={(e) => setUnavailableFrom(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unavailable-to">Unavailable Until (Optional)</Label>
                  <input
                    id="unavailable-to"
                    type="date"
                    value={unavailableTo}
                    onChange={(e) => setUnavailableTo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    min={unavailableFrom}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unavailable-reason">Reason (Optional)</Label>
                <Textarea
                  id="unavailable-reason"
                  value={unavailableReason}
                  onChange={(e) => setUnavailableReason(e.target.value)}
                  placeholder="e.g., Annual leave, medical appointment, etc."
                  className="resize-none"
                  rows={3}
                />
              </div>

              {unavailableFrom && unavailableTo && (
                <p className="text-sm text-muted-foreground">
                  You will be unavailable from {format(new Date(unavailableFrom), 'MMM d, yyyy')} to {format(new Date(unavailableTo), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Schedule</CardTitle>
          <CardDescription>
            Set your regular working hours for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {daysOfWeek.map((day) => {
            const dayData = availability[day.value];
            if (!dayData) return null;

            return (
              <div key={day.value} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2 min-w-[120px]">
                  <Switch
                    checked={dayData.is_available}
                    onCheckedChange={(checked) => updateDay(day.value, 'is_available', checked)}
                  />
                  <Label className="font-semibold">{day.label}</Label>
                </div>
                
                {dayData.is_available && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={dayData.start_time}
                      onChange={(e) => updateDay(day.value, 'start_time', e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={dayData.end_time}
                      onChange={(e) => updateDay(day.value, 'end_time', e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    />
                  </div>
                )}
                
                {!dayData.is_available && (
                  <span className="text-muted-foreground">Unavailable</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
