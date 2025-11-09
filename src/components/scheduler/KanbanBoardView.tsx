import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Clock, MapPin, User, Calendar } from "lucide-react";
import DroppableStatusColumn from "./DroppableStatusColumn";

const STATUSES = [
  { id: "draft", label: "Draft", color: "bg-muted" },
  { id: "published", label: "Scheduled", color: "bg-info/10" },
  { id: "checked_in", label: "In Progress", color: "bg-warning/10" },
  { id: "completed", label: "Completed", color: "bg-success/10" },
];

interface KanbanBoardViewProps {
  appointments: any[];
  onAppointmentClick: (id: string) => void;
}

export default function KanbanBoardView({ appointments, onAppointmentClick }: KanbanBoardViewProps) {
  const queryClient = useQueryClient();
  const [activeAppointment, setActiveAppointment] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: any) => {
    const appointment = appointments.find(apt => apt.id === event.active.id);
    setActiveAppointment(appointment);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAppointment(null);

    if (!over || active.id === over.id) return;

    const appointmentId = active.id as string;
    const newStatus = over.id as "draft" | "published" | "checked_in" | "completed" | "cancelled";

    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment || appointment.status === newStatus) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      
      toast.success(`Appointment moved to ${STATUSES.find(s => s.id === newStatus)?.label}`, {
        description: appointment.title,
      });
    } catch (error: any) {
      toast.error("Failed to update appointment status", {
        description: error.message,
      });
    }
  };

  const appointmentsByStatus = STATUSES.reduce((acc, status) => {
    acc[status.id] = appointments.filter(apt => apt.status === status.id);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map(status => (
          <DroppableStatusColumn
            key={status.id}
            id={status.id}
            title={status.label}
            color={status.color}
            count={appointmentsByStatus[status.id]?.length || 0}
          >
            <div className="space-y-2">
              {appointmentsByStatus[status.id]?.map(appointment => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onClick={() => onAppointmentClick(appointment.id)}
                />
              ))}
              {appointmentsByStatus[status.id]?.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No appointments
                </div>
              )}
            </div>
          </DroppableStatusColumn>
        ))}
      </div>

      <DragOverlay>
        {activeAppointment && (
          <div className="opacity-80">
            <AppointmentCard appointment={activeAppointment} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function AppointmentCard({ appointment, onClick }: { appointment: any; onClick?: () => void }) {
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        onClick && "active:scale-95"
      )}
      onClick={onClick}
    >
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-medium truncate">{appointment.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{format(new Date(appointment.start_time), "MMM d, yyyy")}</span>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {format(new Date(appointment.start_time), "HH:mm")} - 
            {format(new Date(appointment.end_time), "HH:mm")}
          </span>
        </div>

        {appointment.profiles && (
          <div className="flex items-center gap-2 text-xs">
            <User className="h-3 w-3" />
            <span className="truncate">
              {appointment.profiles.first_name} {appointment.profiles.last_name}
            </span>
          </div>
        )}

        {appointment.location_address && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{appointment.location_address.split(',')[0]}</span>
          </div>
        )}

        {appointment.service_orders && (
          <Badge variant="outline" className="text-xs">
            {appointment.service_orders.order_number}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
