import { format } from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, MapPin, User } from "lucide-react";

interface SchedulerDayViewProps {
  currentDate: Date;
}

const mockWorkers = [
  { id: "1", name: "John Smith", role: "Technician" },
  { id: "2", name: "Sarah Johnson", role: "Supervisor" },
  { id: "3", name: "Mike Davis", role: "Technician" },
  { id: "4", name: "Emily Brown", role: "Technician" },
];

const mockAppointments = [
  {
    id: "1",
    title: "HVAC Installation",
    customer: "Acme Corp",
    workerId: "1",
    startTime: "09:00",
    endTime: "11:00",
    status: "published",
    location: "123 Main St",
  },
  {
    id: "2",
    title: "Plumbing Repair",
    customer: "Tech Inc",
    workerId: "1",
    startTime: "14:00",
    endTime: "16:00",
    status: "checked_in",
    location: "456 Oak Ave",
  },
  {
    id: "3",
    title: "Electrical Check",
    customer: "Best Services",
    workerId: "3",
    startTime: "10:00",
    endTime: "12:00",
    status: "published",
    location: "789 Pine Rd",
  },
];

const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 8 PM

const statusColors = {
  draft: "bg-muted border-muted-foreground",
  published: "bg-info/10 border-info",
  checked_in: "bg-warning/10 border-warning",
  completed: "bg-success/10 border-success",
  cancelled: "bg-destructive/10 border-destructive",
};

export default function SchedulerDayView({ currentDate }: SchedulerDayViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      console.log(`Moving appointment ${active.id} to worker ${over.id}`);
      // TODO: Update appointment assignment in database
    }
    
    setActiveId(null);
  };

  const activeAppointment = mockAppointments.find(apt => apt.id === activeId);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Time grid */}
        <div className="grid grid-cols-[100px_1fr] gap-4">
          {/* Time labels */}
          <div className="space-y-[60px] pt-12">
            {hours.map(hour => (
              <div key={hour} className="text-sm text-muted-foreground text-right pr-2">
                {format(new Date().setHours(hour, 0), "h:mm a")}
              </div>
            ))}
          </div>

          {/* Workers columns */}
          <div className="grid grid-cols-4 gap-4">
            {mockWorkers.map(worker => (
              <div key={worker.id} className="space-y-2">
                {/* Worker header */}
                <div className="sticky top-0 bg-background z-10 pb-2 border-b border-border">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {worker.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{worker.role}</div>
                </div>

                {/* Time slots */}
                <div className="relative h-[720px] bg-muted/20 rounded-lg border border-border">
                  {/* Hourly grid lines */}
                  {hours.map((hour, idx) => (
                    <div
                      key={hour}
                      className="absolute w-full border-t border-border/50"
                      style={{ top: `${idx * 60}px` }}
                    />
                  ))}

                  {/* Appointments */}
                  {mockAppointments
                    .filter(apt => apt.workerId === worker.id)
                    .map(apt => {
                      const [startHour, startMin] = apt.startTime.split(":").map(Number);
                      const [endHour, endMin] = apt.endTime.split(":").map(Number);
                      const top = (startHour - 8) * 60 + startMin;
                      const height = (endHour - startHour) * 60 + (endMin - startMin);

                      return (
                        <div
                          key={apt.id}
                          className={cn(
                            "absolute left-1 right-1 p-2 rounded border-l-4 cursor-move hover:shadow-md transition-shadow",
                            statusColors[apt.status as keyof typeof statusColors]
                          )}
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          <div className="text-xs font-medium truncate">{apt.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{apt.customer}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs">{apt.startTime} - {apt.endTime}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            <span className="text-xs truncate">{apt.location}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeAppointment && (
          <div className={cn(
            "p-3 rounded shadow-lg border-l-4 bg-card",
            statusColors[activeAppointment.status as keyof typeof statusColors]
          )}>
            <div className="text-sm font-medium">{activeAppointment.title}</div>
            <div className="text-xs text-muted-foreground">{activeAppointment.customer}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
