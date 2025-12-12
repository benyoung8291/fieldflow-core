import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatMelbourneTime } from "@/lib/utils";
import { Clock, MapPin, User, Calendar } from "lucide-react";
import DroppableStatusColumn from "./DroppableStatusColumn";
import AppointmentContextMenu from "./AppointmentContextMenu";

const STATUSES = [
  { id: "draft", label: "Draft", color: "bg-muted" },
  { id: "published", label: "Scheduled", color: "bg-info/10" },
  { id: "checked_in", label: "In Progress", color: "bg-warning/10" },
  { id: "completed", label: "Completed", color: "bg-success/10" },
];

interface KanbanBoardViewProps {
  appointments: any[];
  onAppointmentClick: (id: string) => void;
  onEditAppointment?: (id: string) => void;
  onRemoveWorker?: (appointmentId: string, workerId: string | null, contactId: string | null) => void;
  onGPSCheckIn?: (appointment: any) => void;
  onDeleteAppointment?: (id: string) => void;
}

export default function KanbanBoardView({ 
  appointments, 
  onAppointmentClick,
  onEditAppointment,
  onRemoveWorker,
  onGPSCheckIn,
  onDeleteAppointment
}: KanbanBoardViewProps) {
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

    // Optimistically update the UI immediately
    const previousAppointments = queryClient.getQueryData<any[]>(["appointments"]);
    
    if (previousAppointments) {
      const updatedAppointments = previousAppointments.map(apt => 
        apt.id === appointmentId 
          ? { ...apt, status: newStatus }
          : apt
      );
      
      queryClient.setQueryData(["appointments"], updatedAppointments);
    }

    // Then sync with backend
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId);

      if (error) throw error;
      
      toast.success(`Appointment moved to ${STATUSES.find(s => s.id === newStatus)?.label}`, {
        description: appointment.title,
      });
    } catch (error: any) {
      // Rollback on error
      if (previousAppointments) {
        queryClient.setQueryData(["appointments"], previousAppointments);
      }
      
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {STATUSES.map(status => (
          <DroppableStatusColumn
            key={status.id}
            id={status.id}
            title={status.label}
            color={status.color}
            count={appointmentsByStatus[status.id]?.length || 0}
          >
            <div className="space-y-1.5">
              {appointmentsByStatus[status.id]?.map(appointment => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onClick={() => onAppointmentClick(appointment.id)}
                  onEdit={() => onEditAppointment?.(appointment.id)}
                  onRemoveWorker={(workerId, contactId) => onRemoveWorker?.(appointment.id, workerId, contactId)}
                  onGPSCheckIn={() => onGPSCheckIn?.(appointment)}
                  onDelete={appointment.status === "draft" ? () => onDeleteAppointment?.(appointment.id) : undefined}
                />
              ))}
              {appointmentsByStatus[status.id]?.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">
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

interface AppointmentCardProps {
  appointment: any;
  onClick?: () => void;
  onEdit?: () => void;
  onRemoveWorker?: (workerId: string | null, contactId: string | null) => void;
  onGPSCheckIn?: () => void;
  onDelete?: () => void;
}

function AppointmentCard({ 
  appointment, 
  onClick, 
  onEdit,
  onRemoveWorker,
  onGPSCheckIn,
  onDelete
}: AppointmentCardProps) {
  return (
    <AppointmentContextMenu
      appointment={appointment}
      onDelete={onDelete}
    >
      <Card 
        className={cn(
          "cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200",
          "border-l-2",
          appointment.status === "draft" && "border-l-muted",
          appointment.status === "published" && "border-l-info",
          appointment.status === "checked_in" && "border-l-warning",
          appointment.status === "completed" && "border-l-success",
          appointment.status === "cancelled" && "border-l-destructive"
        )}
        onClick={onClick}
      >
        <CardHeader className="p-2 pb-1 relative">
          {/* Duration badge - top right */}
          <div className="absolute top-0.5 right-0.5 bg-muted/70 backdrop-blur-sm text-[9px] font-medium px-1 py-0.5 rounded text-muted-foreground z-10">
            {(() => {
              const start = new Date(appointment.start_time);
              const end = new Date(appointment.end_time);
              const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              return (Math.round(hours * 10) / 10).toFixed(1);
            })()}h
          </div>
          
          <CardTitle className="text-xs font-medium truncate pr-10">{appointment.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatMelbourneTime(appointment.start_time, "MMM d")}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {formatMelbourneTime(appointment.start_time, "HH:mm")} - 
              {formatMelbourneTime(appointment.end_time, "HH:mm")}
            </span>
          </div>

          {appointment.appointment_workers && appointment.appointment_workers.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <User className="h-3 w-3" />
              <span className="truncate">
                {appointment.appointment_workers.map((aw: any) => {
                  if (aw.worker_id && aw.profiles) {
                    return `${aw.profiles.first_name} ${aw.profiles.last_name}`;
                  } else if (aw.contact_id && aw.contacts) {
                    const name = `${aw.contacts.first_name || ''} ${aw.contacts.last_name || ''}`.trim();
                    const company = aw.contacts.suppliers?.name;
                    return company ? `${name} (${company})` : name;
                  }
                  return '';
                }).filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {appointment.location_address && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{appointment.location_address.split(',')[0]}</span>
            </div>
          )}

          {appointment.service_orders && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {appointment.service_orders.order_number}
            </Badge>
          )}
        </CardContent>
      </Card>
    </AppointmentContextMenu>
  );
}
