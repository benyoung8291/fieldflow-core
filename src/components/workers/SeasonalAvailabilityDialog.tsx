import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface SeasonalAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  tenantId: string;
  existingData?: any;
}

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const TIME_PERIODS = ['morning', 'afternoon', 'evening', 'anytime'];

export function SeasonalAvailabilityDialog({ 
  open, 
  onOpenChange, 
  workerId, 
  tenantId,
  existingData 
}: SeasonalAvailabilityDialogProps) {
  const queryClient = useQueryClient();
  const [seasonName, setSeasonName] = useState(existingData?.season_name || "");
  const [startDate, setStartDate] = useState(existingData?.start_date || "");
  const [endDate, setEndDate] = useState(existingData?.end_date || "");
  const [notes, setNotes] = useState(existingData?.notes || "");
  const [availability, setAvailability] = useState(() => {
    const initial: Record<string, { available: boolean; periods: string[] }> = {};
    DAYS.forEach(day => {
      initial[day.key] = {
        available: existingData?.[`${day.key}_available`] || false,
        periods: existingData?.[`${day.key}_periods`] || [],
      };
    });
    return initial;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data: any = {
        worker_id: workerId,
        tenant_id: tenantId,
        season_name: seasonName,
        start_date: startDate,
        end_date: endDate,
        notes: notes || null,
      };

      DAYS.forEach(day => {
        data[`${day.key}_available`] = availability[day.key].available;
        data[`${day.key}_periods`] = availability[day.key].periods;
      });

      if (existingData?.id) {
        const { error } = await supabase
          .from('worker_seasonal_availability')
          .update(data)
          .eq('id', existingData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('worker_seasonal_availability')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonal-availability'] });
      toast.success(existingData ? "Seasonal availability updated" : "Seasonal availability added");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to save seasonal availability");
      console.error(error);
    },
  });

  const toggleDay = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        available: !prev[day].available,
      },
    }));
  };

  const togglePeriod = (day: string, period: string) => {
    setAvailability(prev => {
      const currentPeriods = prev[day].periods;
      const newPeriods = currentPeriods.includes(period)
        ? currentPeriods.filter(p => p !== period)
        : [...currentPeriods, period];
      
      return {
        ...prev,
        [day]: {
          ...prev[day],
          periods: newPeriods,
        },
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!seasonName || !startDate || !endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date must be after start date");
      return;
    }

    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingData ? 'Edit' : 'Add'} Seasonal Availability Override
          </DialogTitle>
          <DialogDescription>
            Set special availability for a specific period (e.g., Christmas, summer holidays)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="season-name">Season/Period Name *</Label>
              <Input
                id="season-name"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="e.g., Christmas 2024, Summer Break"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information..."
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">Day Availability</Label>
            <div className="space-y-3">
              {DAYS.map(day => (
                <div key={day.key} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={availability[day.key].available}
                      onCheckedChange={() => toggleDay(day.key)}
                      id={`day-${day.key}`}
                    />
                    <Label htmlFor={`day-${day.key}`} className="font-semibold cursor-pointer">
                      {day.label}
                    </Label>
                  </div>

                  {availability[day.key].available && (
                    <div className="pl-6 space-y-2">
                      <Label className="text-sm text-muted-foreground">Available during:</Label>
                      <div className="flex flex-wrap gap-2">
                        {TIME_PERIODS.map(period => (
                          <label
                            key={period}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                              availability[day.key].periods.includes(period)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={availability[day.key].periods.includes(period)}
                              onChange={() => togglePeriod(day.key, period)}
                              className="sr-only"
                            />
                            <span className="text-sm capitalize">{period}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : existingData ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}