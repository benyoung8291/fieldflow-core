import { useState, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/DashboardLayout";
import { useWorkerAvailabilityMonth } from "@/hooks/useWorkerAvailabilityMonth";
import { WorkerAvailabilityDayCell } from "@/components/availability/WorkerAvailabilityDayCell";
import { WorkerAvailabilityFilters } from "@/components/availability/WorkerAvailabilityFilters";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WorkerAvailabilityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  
  const { workerAvailability, isLoading } = useWorkerAvailabilityMonth(currentMonth);

  // Get unique workers for the filter dropdown
  const allWorkers = useMemo(() => {
    return workerAvailability.map(wa => wa.worker);
  }, [workerAvailability]);

  // Filter worker availability based on selected filters
  const filteredAvailability = useMemo(() => {
    return workerAvailability.filter(wa => {
      if (selectedStates.length > 0 && !selectedStates.includes(wa.worker.worker_state || "")) {
        return false;
      }
      if (selectedWorkerIds.length > 0 && !selectedWorkerIds.includes(wa.worker.id)) {
        return false;
      }
      return true;
    });
  }, [workerAvailability, selectedStates, selectedWorkerIds]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getAvailabilityForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return filteredAvailability.filter(wa => {
      const dayData = wa.days.find(d => d.dateStr === dateStr);
      return dayData?.isAvailable;
    }).map(wa => ({
      worker: wa.worker,
      dayData: wa.days.find(d => d.dateStr === dateStr)!
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">
              Worker Availability Calendar
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-medium min-w-[160px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <WorkerAvailabilityFilters
          workers={allWorkers}
          selectedStates={selectedStates}
          setSelectedStates={setSelectedStates}
          selectedWorkerIds={selectedWorkerIds}
          setSelectedWorkerIds={setSelectedWorkerIds}
        />

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">Partially Assigned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Fully Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-muted-foreground">Seasonal</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b">
              {DAYS_OF_WEEK.map((day, idx) => (
                <div 
                  key={day} 
                  className={`py-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0 ${
                    idx === 0 || idx === 6 ? "bg-muted/30" : ""
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            {isLoading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="h-32 border-r border-b last:border-r-0 p-2">
                    <Skeleton className="h-5 w-5 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((date) => {
                  const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                  const isTodayDate = isToday(date);
                  const isWeekend = getDay(date) === 0 || getDay(date) === 6;
                  const availableWorkers = getAvailabilityForDate(date);

                  return (
                    <WorkerAvailabilityDayCell
                      key={date.toISOString()}
                      date={date}
                      isCurrentMonth={isCurrentMonth}
                      isToday={isTodayDate}
                      isWeekend={isWeekend}
                      availableWorkers={availableWorkers}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
