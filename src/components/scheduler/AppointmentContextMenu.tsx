import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Edit, MapPin, Trash2, UserMinus, Eye } from "lucide-react";

interface AppointmentContextMenuProps {
  children: React.ReactNode;
  appointment: any;
  onEdit: () => void;
  onRemoveWorker: (workerId: string) => void;
  onDelete?: () => void;
  onGPSCheckIn: () => void;
  onViewDetails: () => void;
}

export default function AppointmentContextMenu({
  children,
  appointment,
  onEdit,
  onRemoveWorker,
  onDelete,
  onGPSCheckIn,
  onViewDetails,
}: AppointmentContextMenuProps) {
  const workers = appointment.appointment_workers || [];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onViewDetails}>
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Appointment
        </ContextMenuItem>
        <ContextMenuItem onClick={onGPSCheckIn}>
          <MapPin className="h-4 w-4 mr-2" />
          {appointment.check_in_time ? "Check Out" : "GPS Check In"}
        </ContextMenuItem>

        {workers.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <UserMinus className="h-4 w-4 mr-2" />
                Remove Worker
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {workers.map((worker: any) => (
                  <ContextMenuItem
                    key={worker.worker_id}
                    onClick={() => onRemoveWorker(worker.worker_id)}
                  >
                    {worker.profiles?.first_name} {worker.profiles?.last_name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Appointment
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
