import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, MapPin, TrendingUp, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SmartSchedulingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrders: any[];
  workers: any[];
  onSchedule: (workerId: string, serviceOrderId: string, startTime: Date, endTime: Date) => void;
}

interface TimeSlotSuggestion {
  start_time: string;
  end_time: string;
  score: number;
  reasoning: string;
  skills_match?: boolean;
  travel_time_before?: number;
  travel_time_after?: number;
}

export default function SmartSchedulingDialog({
  open,
  onOpenChange,
  serviceOrders,
  workers,
  onSchedule,
}: SmartSchedulingDialogProps) {
  const [selectedServiceOrder, setSelectedServiceOrder] = useState<string>("");
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState<Date>(new Date());
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>();
  const [suggestions, setSuggestions] = useState<TimeSlotSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetSuggestions = async () => {
    if (!selectedServiceOrder || !selectedWorker) {
      toast.error("Please select a service order and worker");
      return;
    }

    setIsLoading(true);
    setSuggestions([]);

    try {
      const serviceOrder = serviceOrders.find(so => so.id === selectedServiceOrder);
      
      const { data, error } = await supabase.functions.invoke('suggest-time-slots', {
        body: {
          workerId: selectedWorker,
          serviceOrderId: selectedServiceOrder,
          preferredDate: preferredDate.toISOString(),
          dateRangeEnd: dateRangeEnd?.toISOString(),
          estimatedDuration: serviceOrder?.estimated_hours || 2,
        }
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("Too many requests. Please wait a moment and try again.");
        } else if (data.error.includes("Payment required")) {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      setSuggestions(data.suggestions || []);
      
      if (!data.suggestions || data.suggestions.length === 0) {
        toast.info("No optimal time slots found for the selected criteria");
      } else {
        toast.success(`Found ${data.suggestions.length} optimal time slots`);
      }
    } catch (error: any) {
      console.error("Error getting suggestions:", error);
      toast.error("Failed to get scheduling suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSlot = (suggestion: TimeSlotSuggestion) => {
    onSchedule(
      selectedWorker,
      selectedServiceOrder,
      new Date(suggestion.start_time),
      new Date(suggestion.end_time)
    );
    onOpenChange(false);
    toast.success("Appointment scheduled at optimal time");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-success text-success-foreground";
    if (score >= 60) return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Smart Scheduling Assistant</DialogTitle>
          <DialogDescription>
            AI-powered scheduling suggestions based on worker availability and travel optimization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="service-order">Service Order</Label>
            <Select value={selectedServiceOrder} onValueChange={setSelectedServiceOrder}>
              <SelectTrigger id="service-order">
                <SelectValue placeholder="Select service order" />
              </SelectTrigger>
              <SelectContent>
                {serviceOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.order_number} - {order.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker">Worker</Label>
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger id="worker">
                <SelectValue placeholder="Select worker" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.first_name} {worker.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preferred Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !preferredDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preferredDate ? format(preferredDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={preferredDate}
                    onSelect={(date) => date && setPreferredDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date Range End (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRangeEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeEnd ? format(dateRangeEnd, "PPP") : "Flexible dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRangeEnd}
                    onSelect={setDateRangeEnd}
                    disabled={(date) => date < preferredDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button 
            onClick={handleGetSuggestions} 
            disabled={isLoading || !selectedServiceOrder || !selectedWorker}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing schedule...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Get Smart Suggestions
              </>
            )}
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-3 pt-4">
              <h3 className="text-sm font-semibold">Suggested Time Slots</h3>
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        Option {index + 1}
                        {suggestion.skills_match === false && (
                          <Badge variant="destructive" className="text-xs">
                            Skills Mismatch
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge className={cn("text-xs", getScoreColor(suggestion.score))}>
                        {suggestion.score}% optimal
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(suggestion.start_time), "EEE, MMM d, h:mm a")} - 
                        {format(new Date(suggestion.end_time), "h:mm a")}
                      </span>
                    </div>

                    {(suggestion.travel_time_before || suggestion.travel_time_after) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          Travel: {suggestion.travel_time_before || 0} min before, {suggestion.travel_time_after || 0} min after
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>

                    <Button 
                      onClick={() => handleSelectSlot(suggestion)}
                      variant="default"
                      size="sm"
                      className="w-full"
                    >
                      Schedule at this time
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
