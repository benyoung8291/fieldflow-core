import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format, addDays, eachDayOfInterval, startOfDay, isSameDay } from "date-fns";
import { ChevronRight, Check, Calendar as CalendarIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SeasonalAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  tenantId: string;
  existingData?: any;
}

const TIME_PERIODS = [
  { id: 'morning', label: 'Morning', emoji: '🌅' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️' },
  { id: 'evening', label: 'Evening', emoji: '🌙' },
  { id: 'anytime', label: 'Anytime', emoji: '⏰' },
];

// Calculate 6 weeks starting from the Saturday before Christmas
const getDefaultDateRange = () => {
  const currentYear = new Date().getFullYear();
  const christmas = new Date(currentYear, 11, 25); // Dec 25
  const christmasDay = christmas.getDay();
  
  // Find the Saturday before Christmas (or Christmas if it's Saturday)
  const daysToSaturday = christmasDay === 6 ? 0 : (christmasDay + 1);
  const startDate = addDays(christmas, -daysToSaturday);
  const endDate = addDays(startDate, 42); // 6 weeks = 42 days
  
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dateAvailability, setDateAvailability] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState<'details' | 'dates'>(existingData ? 'dates' : 'details');

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
      
      // If selecting "anytime", clear other periods and set only anytime
      if (period === 'anytime') {
        const isCurrentlySelected = currentPeriods.includes('anytime');
        return {
          ...prev,
          [date]: isCurrentlySelected ? [] : ['anytime'],
        };
      }
      
      // If selecting specific period, remove "anytime" if present
      const withoutAnytime = currentPeriods.filter(p => p !== 'anytime');
      const newPeriods = withoutAnytime.includes(period)
        ? withoutAnytime.filter(p => p !== period)
        : [...withoutAnytime, period];
      
      return {
        ...prev,
        [date]: newPeriods,
      };
    });
  };

  const allDatesInRange = startDate && endDate 
    ? eachDayOfInterval({ 
        start: startOfDay(new Date(startDate)), 
        end: startOfDay(new Date(endDate)) 
      })
    : [];

  const getDateStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const periods = dateAvailability[dateStr] || [];
    if (periods.length === 0) return 'none';
    if (periods.length === TIME_PERIODS.length || periods.includes('anytime')) return 'full';
    return 'partial';
  };

  const quickSelectAll = () => {
    const newAvailability: Record<string, string[]> = {};
    allDatesInRange.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      newAvailability[dateStr] = ['anytime'];
    });
    setDateAvailability(newAvailability);
    toast.success("All dates marked as available anytime");
  };

  const clearAll = () => {
    setDateAvailability({});
    toast.success("All availability cleared");
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!seasonName || !startDate || !endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date must be after start date");
      return;
    }

    setStep('dates');
  };

  const handleSubmit = () => {
    const selectedDatesCount = Object.values(dateAvailability).filter(p => p.length > 0).length;
    if (selectedDatesCount === 0) {
      toast.error("Please select at least one date with availability");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {existingData ? 'Edit' : 'Set'} Availability Period
          </DialogTitle>
          <DialogDescription>
            {step === 'details' 
              ? 'First, define the period details'
              : 'Tap each date to set when you\'re available'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'details' ? (
          <form onSubmit={handleNext} className="flex flex-col h-full">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-4 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="season-name" className="text-base">Period Name</Label>
                  <Input
                    id="season-name"
                    value={seasonName}
                    onChange={(e) => setSeasonName(e.target.value)}
                    placeholder="e.g., Christmas 2024, Summer Break"
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Date Range</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="start-date" className="text-sm text-muted-foreground">From</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date" className="text-sm text-muted-foreground">To</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="h-12"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {allDatesInRange.length} days in this period
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-base">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional information..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </ScrollArea>

            <div className="p-6 pt-4 border-t flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1 h-12"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-12">
                Next: Select Dates
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-6 pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium">{seasonName}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(startDate), 'MMM d')} - {format(new Date(endDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setStep('details')}
                >
                  Edit Details
                </Button>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={quickSelectAll}
                  className="flex-1 h-9"
                >
                  Available All Days
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={clearAll}
                  className="flex-1 h-9"
                >
                  Clear All
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Full day</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Partial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-muted" />
                  <span>Not set</span>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 px-6">
              <div className="space-y-2 pb-4">
                {allDatesInRange.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const periods = dateAvailability[dateStr] || [];
                  const status = getDateStatus(date);
                  const isExpanded = expandedDate === dateStr;

                  return (
                    <div key={dateStr} className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedDate(isExpanded ? null : dateStr)}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            status === 'full' && "bg-green-500",
                            status === 'partial' && "bg-amber-500",
                            status === 'none' && "bg-muted"
                          )} />
                          <div className="text-left">
                            <p className="font-medium">
                              {format(date, 'EEEE, MMM d')}
                            </p>
                            {periods.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {periods.map(p => TIME_PERIODS.find(tp => tp.id === p)?.emoji).join(' ')}
                                {' '}
                                {periods.map(p => TIME_PERIODS.find(tp => tp.id === p)?.label).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform",
                          isExpanded && "rotate-90"
                        )} />
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 bg-muted/20">
                          <p className="text-sm font-medium mb-2">When are you available?</p>
                          <div className="grid grid-cols-2 gap-2">
                            {TIME_PERIODS.map(period => {
                              const isSelected = periods.includes(period.id);
                              return (
                                <button
                                  key={period.id}
                                  type="button"
                                  onClick={() => togglePeriod(dateStr, period.id)}
                                  className={cn(
                                    "p-3 rounded-lg border-2 flex items-center gap-2 transition-all",
                                    isSelected 
                                      ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                                      : "bg-background border-border hover:border-primary/50"
                                  )}
                                >
                                  <span className="text-lg">{period.emoji}</span>
                                  <span className="text-sm font-medium">{period.label}</span>
                                  {isSelected && <Check className="h-4 w-4 ml-auto" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="p-6 pt-4 border-t">
              <div className="mb-3 text-center text-sm text-muted-foreground">
                {Object.values(dateAvailability).filter(p => p.length > 0).length} of {allDatesInRange.length} dates set
              </div>
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="flex-1 h-12"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={saveMutation.isPending}
                  className="flex-1 h-12"
                >
                  {saveMutation.isPending ? 'Saving...' : existingData ? 'Update Availability' : 'Save Availability'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}