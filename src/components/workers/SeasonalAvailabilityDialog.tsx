import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, addWeeks, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";

interface SeasonalAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  tenantId: string;
  existingData?: any;
}

const TIME_PERIODS = ['morning', 'afternoon', 'evening', 'anytime'];

// Calculate 6 weeks starting from the Saturday before Christmas
const getDefaultDateRange = () => {
  const currentYear = new Date().getFullYear();
  const christmas = new Date(currentYear, 11, 25); // Dec 25
  const christmasDay = christmas.getDay();
  
  // Find the Saturday before Christmas (or Christmas if it's Saturday)
  const daysToSaturday = christmasDay === 6 ? 0 : (christmasDay + 1);
  const startDate = addDays(christmas, -daysToSaturday);
  const endDate = addWeeks(startDate, 6);
  
  return { startDate, endDate };
};

export function SeasonalAvailabilityDialog({ 
  open, 
  onOpenChange, 
  workerId, 
  tenantId,
  existingData 
}: SeasonalAvailabilityDialogProps) {
  const queryClient = useQueryClient();
  const defaultRange = getDefaultDateRange();
  
  const [seasonName, setSeasonName] = useState(existingData?.season_name || "Christmas Period");
  const [startDate, setStartDate] = useState(
    existingData?.start_date || format(defaultRange.startDate, 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    existingData?.end_date || format(defaultRange.endDate, 'yyyy-MM-dd')
  );
  const [notes, setNotes] = useState(existingData?.notes || "");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateAvailability, setDateAvailability] = useState<Record<string, string[]>>({});

  // Fetch existing date availability
  const { data: existingDates } = useQuery({
    queryKey: ['seasonal-dates', existingData?.id],
    queryFn: async () => {
      if (!existingData?.id) return [];
      const { data, error } = await supabase
        .from('worker_seasonal_availability_dates')
        .select('*')
        .eq('seasonal_availability_id', existingData.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!existingData?.id && open,
  });

  useEffect(() => {
    if (existingDates) {
      const availability: Record<string, string[]> = {};
      existingDates.forEach((date: any) => {
        availability[date.date] = date.periods || [];
      });
      setDateAvailability(availability);
    }
  }, [existingDates]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const periodData: any = {
        worker_id: workerId,
        tenant_id: tenantId,
        season_name: seasonName,
        start_date: startDate,
        end_date: endDate,
        notes: notes || null,
      };

      let periodId = existingData?.id;

      if (existingData?.id) {
        const { error } = await supabase
          .from('worker_seasonal_availability')
          .update(periodData)
          .eq('id', existingData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('worker_seasonal_availability')
          .insert(periodData)
          .select()
          .single();
        if (error) throw error;
        periodId = data.id;
      }

      // Delete existing dates if updating
      if (existingData?.id) {
        await supabase
          .from('worker_seasonal_availability_dates')
          .delete()
          .eq('seasonal_availability_id', existingData.id);
      }

      // Insert date-specific availability
      const dateRecords = Object.entries(dateAvailability)
        .filter(([_, periods]) => periods.length > 0)
        .map(([date, periods]) => ({
          seasonal_availability_id: periodId,
          date,
          periods,
          tenant_id: tenantId,
        }));

      if (dateRecords.length > 0) {
        const { error } = await supabase
          .from('worker_seasonal_availability_dates')
          .insert(dateRecords);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasonal-availability'] });
      queryClient.invalidateQueries({ queryKey: ['seasonal-dates'] });
      toast.success(existingData ? "Seasonal availability updated" : "Seasonal availability added");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to save seasonal availability");
      console.error(error);
    },
  });

  const togglePeriod = (date: string, period: string) => {
    setDateAvailability(prev => {
      const currentPeriods = prev[date] || [];
      const newPeriods = currentPeriods.includes(period)
        ? currentPeriods.filter(p => p !== period)
        : [...currentPeriods, period];
      
      return {
        ...prev,
        [date]: newPeriods,
      };
    });
  };

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDatePeriods = selectedDateStr ? (dateAvailability[selectedDateStr] || []) : [];

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingData ? 'Edit' : 'Add'} Seasonal Availability Override
          </DialogTitle>
          <DialogDescription>
            Select specific dates and time periods when you're available (defaults to 6 weeks from weekend before Christmas)
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
            <Label className="text-base font-semibold">Date-Specific Availability</Label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Select dates you're available</Label>
                <div className="border rounded-lg p-3">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      return dateStr < startDate || dateStr > endDate;
                    }}
                    modifiers={{
                      hasAvailability: (date) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        return (dateAvailability[dateStr]?.length || 0) > 0;
                      }
                    }}
                    modifiersClassNames={{
                      hasAvailability: "bg-primary/20 font-bold"
                    }}
                    className="rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm">
                  {selectedDate 
                    ? `Availability for ${format(selectedDate, 'MMM d, yyyy')}`
                    : 'Select a date to set availability'}
                </Label>
                
                {selectedDate && selectedDateStr && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {TIME_PERIODS.map(period => (
                        <label
                          key={period}
                          className={`flex items-center gap-2 px-4 py-3 rounded-md border cursor-pointer transition-colors ${
                            selectedDatePeriods.includes(period)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDatePeriods.includes(period)}
                            onChange={() => togglePeriod(selectedDateStr, period)}
                            className="sr-only"
                          />
                          <span className="text-sm capitalize font-medium">{period}</span>
                        </label>
                      ))}
                    </div>
                    
                    {selectedDatePeriods.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Select at least one time period to mark this date as available
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <Label className="text-sm font-semibold">Summary</Label>
                  <div className="text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {Object.entries(dateAvailability)
                      .filter(([_, periods]) => periods.length > 0)
                      .sort()
                      .map(([date, periods]) => (
                        <div key={date} className="flex items-center justify-between py-1">
                          <span className="font-medium">{format(new Date(date + 'T00:00:00'), 'MMM d, yyyy')}</span>
                          <span className="text-xs">
                            {periods.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                          </span>
                        </div>
                      ))}
                    {Object.keys(dateAvailability).filter(date => dateAvailability[date].length > 0).length === 0 && (
                      <p className="text-center py-2">No dates selected yet</p>
                    )}
                  </div>
                </div>
              </div>
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