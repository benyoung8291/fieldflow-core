import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { AlertCircle, Save } from "lucide-react";
import { SeasonalAvailabilityList } from "@/components/workers/SeasonalAvailabilityList";
import { WorkerHeader } from "@/components/worker/WorkerHeader";

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

  // Single query to fetch user, profile, and availability in parallel
  const { data: workerData, isLoading } = useQuery({
    queryKey: ['worker-calendar-data'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Run profile and availability queries in parallel
      const [profileResult, availabilityResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('tenant_id, status')
          .eq('id', user.id)
          .single(),
        supabase
          .from("worker_availability")
          .select("*")
          .eq("worker_id", user.id)
      ]);

      if (profileResult.error) throw profileResult.error;
      if (availabilityResult.error) throw availabilityResult.error;

      return {
        user,
        profile: profileResult.data,
        availability: availabilityResult.data || []
      };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Initialize state from fetched data
  useEffect(() => {
    if (workerData) {
      // Set unavailable status
      if (workerData.profile?.status === 'unavailable') {
        setIsUnavailable(true);
      }

      // Build availability map
      const availabilityMap: AvailabilityData = {};
      daysOfWeek.forEach(day => {
        const existing = workerData.availability.find((d: WorkerAvailability) => d.day_of_week === day.value);
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
    }
  }, [workerData]);

  const saveAvailability = useMutation({
    mutationFn: async () => {
      if (!workerData?.user?.id || !workerData?.profile?.tenant_id) {
        throw new Error("User data not loaded");
      }

      // Build updates, excluding undefined ids for new records
      const updates = Object.entries(availability).map(([day, data]) => ({
        ...(data.id ? { id: data.id } : {}), // Only include id if it exists
        worker_id: workerData.user.id,
        tenant_id: workerData.profile.tenant_id,
        day_of_week: day,
        is_available: data.is_available,
        start_time: data.start_time,
        end_time: data.end_time,
      }));

      // Upsert all availability records
      const { error: availError } = await supabase
        .from("worker_availability")
        .upsert(updates as any, { onConflict: 'worker_id,day_of_week' });

      if (availError) throw availError;

      // Update profile status
      const newStatus = isUnavailable ? 'unavailable' : 'available';
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          status: newStatus,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', workerData.user.id);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-calendar-data"] });
      toast.success("Availability updated");
    },
    onError: (error: Error) => {
      console.error("Availability save error:", error);
      toast.error(error.message || "Failed to update availability");
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

  return (
    <div className="container mx-auto px-4 pb-32 space-y-6">
      <div className="-mx-4">
        <WorkerHeader title="My Availability" />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
      {/* Unavailability Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unavailability Status</CardTitle>
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
            <Label className="text-base cursor-pointer">
              I am currently unavailable
            </Label>
          </div>

          {isUnavailable && (
            <div className="space-y-4 pl-4 border-l-2 border-warning/50">
              <div className="flex items-start gap-2 text-warning">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <p className="text-sm">
                  You will not be assigned to new appointments while marked as unavailable
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unavailable-from" className="text-sm font-medium">Unavailable From (Optional)</Label>
                  <Input
                    id="unavailable-from"
                    type="date"
                    value={unavailableFrom}
                    onChange={(e) => setUnavailableFrom(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unavailable-to" className="text-sm font-medium">Unavailable Until (Optional)</Label>
                  <Input
                    id="unavailable-to"
                    type="date"
                    value={unavailableTo}
                    onChange={(e) => setUnavailableTo(e.target.value)}
                    className="h-10"
                    min={unavailableFrom}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unavailable-reason" className="text-sm font-medium">Reason (Optional)</Label>
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
          <CardTitle className="text-lg">Weekly Schedule</CardTitle>
          <CardDescription>
            Set your regular working hours for each day of the week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {daysOfWeek.map((day) => {
            const dayData = availability[day.value];
            if (!dayData) return null;

            return (
              <div key={day.value} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-[140px]">
                  <Switch
                    checked={dayData.is_available}
                    onCheckedChange={(checked) => updateDay(day.value, 'is_available', checked)}
                  />
                  <Label className="font-semibold text-sm cursor-pointer">{day.label}</Label>
                </div>
                
                {dayData.is_available && (
                  <>
                    {(dayData.start_time === "00:00" && dayData.end_time === "23:59") ? (
                      <span className="text-sm text-primary font-medium">Available anytime</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <Input
                          type="time"
                          value={dayData.start_time}
                          onChange={(e) => updateDay(day.value, 'start_time', e.target.value)}
                          className="h-9 w-28"
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={dayData.end_time}
                          onChange={(e) => updateDay(day.value, 'end_time', e.target.value)}
                          className="h-9 w-28"
                        />
                      </div>
                    )}
                  </>
                )}
                
                {!dayData.is_available && (
                  <span className="text-sm text-muted-foreground">Unavailable</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Seasonal Availability */}
      {workerData?.profile?.tenant_id && (
        <SeasonalAvailabilityList 
          workerId={workerData.user.id} 
          tenantId={workerData.profile.tenant_id}
        />
      )}

      <Button
        onClick={() => saveAvailability.mutate()}
        disabled={saveAvailability.isPending}
        className="w-full h-12 text-base font-semibold shadow-sm"
      >
        {saveAvailability.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </>
        )}
      </Button>
      </>
      )}
    </div>
  );
}
