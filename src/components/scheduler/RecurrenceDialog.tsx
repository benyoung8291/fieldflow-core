import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface RecurrenceConfig {
  pattern: "daily" | "weekly" | "monthly" | null;
  frequency: number;
  endDate: Date | null;
  daysOfWeek: string[];
}

interface RecurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: RecurrenceConfig) => void;
  initialConfig?: RecurrenceConfig;
}

export default function RecurrenceDialog({ 
  open, 
  onOpenChange, 
  onSave,
  initialConfig 
}: RecurrenceDialogProps) {
  const [pattern, setPattern] = useState<"daily" | "weekly" | "monthly" | null>(
    initialConfig?.pattern || null
  );
  const [frequency, setFrequency] = useState(initialConfig?.frequency || 1);
  const [endDate, setEndDate] = useState<Date | null>(initialConfig?.endDate || null);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(initialConfig?.daysOfWeek || []);

  const toggleDay = (day: string) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    onSave({
      pattern,
      frequency,
      endDate,
      daysOfWeek,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recurrence Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Repeat Pattern</Label>
            <Select 
              value={pattern || ""} 
              onValueChange={(value) => setPattern(value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pattern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pattern && (
            <>
              <div>
                <Label>Repeat Every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={frequency}
                    onChange={(e) => setFrequency(parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">
                    {pattern === "daily" && "day(s)"}
                    {pattern === "weekly" && "week(s)"}
                    {pattern === "monthly" && "month(s)"}
                  </span>
                </div>
              </div>

              {pattern === "weekly" && (
                <div>
                  <Label>Repeat On</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day}
                        type="button"
                        variant={daysOfWeek.includes(day) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDay(day)}
                      >
                        {day.substring(0, 3)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "No end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate || undefined}
                      onSelect={(date) => setEndDate(date || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!pattern}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
